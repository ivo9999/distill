package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sislelabs/distill/apps/api/internal/auth"
	"github.com/sislelabs/distill/apps/api/internal/db"
	"github.com/sislelabs/distill/apps/api/internal/jobs"
)

type createNewsletterRequest struct {
	DraftMarkdown  string  `json:"draft_markdown"`
	CostUsd        float64 `json:"cost_usd"`
	Pass1TokensIn  int32   `json:"pass1_tokens_in"`
	Pass1TokensOut int32   `json:"pass1_tokens_out"`
	Pass2TokensIn  int32   `json:"pass2_tokens_in"`
	Pass2TokensOut int32   `json:"pass2_tokens_out"`
	IsOnDemand     bool    `json:"is_on_demand"`
}

func createNewsletter(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var serverID pgtype.UUID
		if err := serverID.Scan(chi.URLParam(r, "serverID")); err != nil {
			writeError(w, http.StatusBadRequest, "invalid server ID")
			return
		}

		server, err := s.Queries.GetServerByID(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusNotFound, "server not found")
			return
		}
		if server.UserID != userID {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		var req createNewsletterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.DraftMarkdown == "" {
			writeError(w, http.StatusBadRequest, "draft_markdown is required")
			return
		}

		// Free-tier gate: non-active users get exactly 1 on-demand generation,
		// counted lifetime per Discord guild (so a fresh account on the same
		// guild does not reset the quota). Scheduled generations (is_on_demand=false)
		// are unaffected.
		if req.IsOnDemand {
			user, err := s.Queries.GetUserByID(r.Context(), userID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get user")
				return
			}
			if user.SubscriptionStatus != "active" {
				guildUsed, err := s.Queries.CountOnDemandEverForGuild(r.Context(), server.DiscordGuildID)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "failed to count guild generations")
					return
				}
				if guildUsed >= 1 {
					writeError(w, http.StatusPaymentRequired, "free tier limit reached: subscribe to generate more")
					return
				}
			}
		}

		now := time.Now().UTC()
		periodStart := pgtype.Timestamptz{Time: now.Add(-7 * 24 * time.Hour), Valid: true}
		periodEnd := pgtype.Timestamptz{Time: now, Valid: true}

		var costNum pgtype.Numeric
		_ = costNum.Scan(fmt.Sprintf("%f", req.CostUsd))

		nl, err := s.Queries.CreateNewsletter(r.Context(), db.CreateNewsletterParams{
			ServerID:       serverID,
			PeriodStart:    periodStart,
			PeriodEnd:      periodEnd,
			Status:         "draft",
			DraftMarkdown:  req.DraftMarkdown,
			CostUsd:        costNum,
			Pass1TokensIn:  req.Pass1TokensIn,
			Pass1TokensOut: req.Pass1TokensOut,
			Pass2TokensIn:  req.Pass2TokensIn,
			Pass2TokensOut: req.Pass2TokensOut,
			ErrorMessage:   pgtype.Text{Valid: false},
			IsOnDemand:     req.IsOnDemand,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create newsletter")
			return
		}

		writeJSON(w, http.StatusCreated, nl)
	}
}

func getGenerationQuota(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var serverID pgtype.UUID
		if err := serverID.Scan(chi.URLParam(r, "serverID")); err != nil {
			writeError(w, http.StatusBadRequest, "invalid server ID")
			return
		}

		server, err := s.Queries.GetServerByID(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusNotFound, "server not found")
			return
		}
		if server.UserID != userID {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		user, err := s.Queries.GetUserByID(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get user")
			return
		}

		used, err := s.Queries.CountOnDemandThisMonth(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to count on-demand generations")
			return
		}

		// Admins get unlimited
		uid := fmt.Sprintf("%x-%x-%x-%x-%x",
			userID.Bytes[0:4], userID.Bytes[4:6], userID.Bytes[6:8], userID.Bytes[8:10], userID.Bytes[10:16])
		if s.isAdmin(uid) {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"used":      used,
				"limit":     int32(999),
				"tier":      "admin",
				"remaining": int32(999) - used,
			})
			return
		}

		// Free tier: 1 lifetime on-demand generation per Discord guild.
		// Counted across all servers rows that share the same discord_guild_id,
		// so deleting and re-adding (or making a new account) does not reset it.
		if user.SubscriptionStatus != "active" {
			guildUsed, err := s.Queries.CountOnDemandEverForGuild(r.Context(), server.DiscordGuildID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to count guild generations")
				return
			}
			remaining := int32(1) - guildUsed
			if remaining < 0 {
				remaining = 0
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"used":      guildUsed,
				"limit":     int32(1),
				"tier":      "free",
				"remaining": remaining,
			})
			return
		}

		// Starter: 3/month, Pro: 10/month
		// TODO: differentiate starter vs pro via Stripe price ID
		limit := int32(3)
		tier := "starter"

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"used":      used,
			"limit":     limit,
			"tier":      tier,
			"remaining": limit - used,
		})
	}
}

func listNewsletters(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var serverID pgtype.UUID
		if err := serverID.Scan(chi.URLParam(r, "serverID")); err != nil {
			writeError(w, http.StatusBadRequest, "invalid server ID")
			return
		}

		// Verify ownership.
		server, err := s.Queries.GetServerByID(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusNotFound, "server not found")
			return
		}
		if server.UserID != userID {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		newsletters, err := s.Queries.ListNewslettersByServerID(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list newsletters")
			return
		}

		writeJSON(w, http.StatusOK, newsletters)
	}
}

func getNewsletter(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var nlID pgtype.UUID
		if err := nlID.Scan(chi.URLParam(r, "newsletterID")); err != nil {
			writeError(w, http.StatusBadRequest, "invalid newsletter ID")
			return
		}

		nl, err := s.Queries.GetNewsletterByID(r.Context(), nlID)
		if err != nil {
			writeError(w, http.StatusNotFound, "newsletter not found")
			return
		}

		// Verify ownership via server.
		server, err := s.Queries.GetServerByID(r.Context(), nl.ServerID)
		if err != nil {
			writeError(w, http.StatusNotFound, "server not found")
			return
		}
		if server.UserID != userID {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		writeJSON(w, http.StatusOK, nl)
	}
}

type updateNewsletterRequest struct {
	EditedMarkdown string `json:"edited_markdown"`
}

func updateNewsletter(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var nlID pgtype.UUID
		if err := nlID.Scan(chi.URLParam(r, "newsletterID")); err != nil {
			writeError(w, http.StatusBadRequest, "invalid newsletter ID")
			return
		}

		nl, err := s.Queries.GetNewsletterByID(r.Context(), nlID)
		if err != nil {
			writeError(w, http.StatusNotFound, "newsletter not found")
			return
		}

		server, err := s.Queries.GetServerByID(r.Context(), nl.ServerID)
		if err != nil {
			writeError(w, http.StatusNotFound, "server not found")
			return
		}
		if server.UserID != userID {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		var req updateNewsletterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		updated, err := s.Queries.UpdateNewsletterMarkdown(r.Context(), db.UpdateNewsletterMarkdownParams{
			ID:             nlID,
			EditedMarkdown: pgtype.Text{String: req.EditedMarkdown, Valid: true},
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update newsletter")
			return
		}

		writeJSON(w, http.StatusOK, updated)
	}
}

type publishNewsletterRequest struct {
	Platform string `json:"platform"`
	Subject  string `json:"subject"`
}

func publishNewsletter(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var nlID pgtype.UUID
		if err := nlID.Scan(chi.URLParam(r, "newsletterID")); err != nil {
			writeError(w, http.StatusBadRequest, "invalid newsletter ID")
			return
		}

		nl, err := s.Queries.GetNewsletterByID(r.Context(), nlID)
		if err != nil {
			writeError(w, http.StatusNotFound, "newsletter not found")
			return
		}

		server, err := s.Queries.GetServerByID(r.Context(), nl.ServerID)
		if err != nil {
			writeError(w, http.StatusNotFound, "server not found")
			return
		}
		if server.UserID != userID {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		// Publishing is paywalled: free-tier users can generate a draft but
		// must subscribe to ship it.
		user, err := s.Queries.GetUserByID(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get user")
			return
		}
		if user.SubscriptionStatus != "active" {
			writeError(w, http.StatusPaymentRequired, "subscribe to publish newsletters")
			return
		}

		var req publishNewsletterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Platform == "" || req.Subject == "" {
			writeError(w, http.StatusBadRequest, "platform and subject are required")
			return
		}

		if s.RiverClient == nil {
			writeError(w, http.StatusServiceUnavailable, "job queue not available")
			return
		}

		_, err = s.RiverClient.Insert(r.Context(), jobs.PublishNewsletterArgs{
			NewsletterID: nlID,
			UserID:       userID,
			Platform:     req.Platform,
			Subject:      req.Subject,
		}, nil)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to enqueue publish job")
			return
		}

		writeJSON(w, http.StatusAccepted, map[string]string{"status": "publishing"})
	}
}
