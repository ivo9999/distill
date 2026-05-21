package http

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sislelabs/distill/apps/api/internal/auth"
	"github.com/sislelabs/distill/apps/api/internal/db"
	"github.com/sislelabs/distill/apps/api/internal/jobs"
)

type createNewsletterRequest struct {
	DraftMarkdown  string          `json:"draft_markdown"`
	CostUsd        float64         `json:"cost_usd"`
	Pass1TokensIn  int32           `json:"pass1_tokens_in"`
	Pass1TokensOut int32           `json:"pass1_tokens_out"`
	Pass2TokensIn  int32           `json:"pass2_tokens_in"`
	Pass2TokensOut int32           `json:"pass2_tokens_out"`
	IsOnDemand     bool            `json:"is_on_demand"`
	// Per-section source-message map produced by the TS pipeline.
	// json.RawMessage so we forward it to JSONB unchanged — we don't
	// validate the shape here (the pipeline owns it); the editor side
	// is the only reader.
	Sources json.RawMessage `json:"sources,omitempty"`
}

func createNewsletter(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB cap

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

		if len(req.Sources) > 1<<20 {
			writeError(w, http.StatusBadRequest, "sources payload too large")
			return
		}

		if req.DraftMarkdown == "" {
			writeError(w, http.StatusBadRequest, "draft_markdown is required")
			return
		}

		// Free-tier gate: non-active users get exactly 1 on-demand generation,
		// counted lifetime per Discord guild (so a fresh account on the same
		// guild does not reset the quota). Admins bypass. Scheduled generations
		// (is_on_demand=false) are unaffected.
		//
		// freeTierOnDemand is computed once here and reused after the
		// newsletter is saved to decide whether to record the free
		// generation in the guild ledger — avoids a second GetUserByID.
		freeTierOnDemand := false
		if req.IsOnDemand && !s.isAdminUUID(userID) {
			user, err := s.Queries.GetUserByID(r.Context(), userID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get user")
				return
			}
			if user.SubscriptionStatus != "active" {
				freeTierOnDemand = true
				used, err := s.Queries.GuildFreeGenerationUsed(r.Context(), server.DiscordGuildID)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "failed to check guild quota")
					return
				}
				if used {
					writeError(w, http.StatusPaymentRequired, "free tier limit reached: subscribe to generate more")
					return
				}
			} else {
				// Pro: re-check the monthly on-demand cap server-side.
				// The UI pre-checks too, but only this server-side
				// check stops parallel requests from bypassing the cap.
				const proMonthlyLimit int32 = 10
				usedThisMonth, cerr := s.Queries.CountOnDemandThisMonth(r.Context(), serverID)
				if cerr != nil {
					writeError(w, http.StatusInternalServerError, "failed to check monthly quota")
					return
				}
				if usedThisMonth >= proMonthlyLimit {
					writeError(w, http.StatusPaymentRequired, "monthly on-demand limit reached")
					return
				}
			}
		}

		now := time.Now().UTC()
		periodStart := pgtype.Timestamptz{Time: now.Add(-7 * 24 * time.Hour), Valid: true}
		periodEnd := pgtype.Timestamptz{Time: now, Valid: true}

		var costNum pgtype.Numeric
		_ = costNum.Scan(fmt.Sprintf("%f", req.CostUsd))

		sources := []byte("[]")
		if len(req.Sources) > 0 {
			sources = req.Sources
		}

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
			Sources:        sources,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create newsletter")
			return
		}

		// Record the free generation against the Discord guild so it
		// survives a server delete + re-add. Free-tier on-demand only
		// (freeTierOnDemand, computed at the gate above); idempotent
		// (ON CONFLICT DO NOTHING). Non-fatal — the newsletter is
		// already saved — so log-and-continue.
		if freeTierOnDemand {
			if merr := s.Queries.MarkGuildFreeGenerationUsed(r.Context(), server.DiscordGuildID); merr != nil {
				slog.Error("failed to mark guild free generation used",
					"guild", server.DiscordGuildID, "err", merr)
			}
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

		// Admins get unlimited, no DB lookup needed.
		if s.isAdminUUID(userID) {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"used":      int32(0),
				"limit":     int32(999),
				"tier":      "admin",
				"remaining": int32(999),
			})
			return
		}

		user, err := s.Queries.GetUserByID(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get user")
			return
		}

		// Free tier: 1 lifetime on-demand generation per Discord guild.
		// Counted across all servers rows that share the same discord_guild_id,
		// so deleting and re-adding (or making a new account) does not reset it.
		if user.SubscriptionStatus != "active" {
			used, err := s.Queries.GuildFreeGenerationUsed(r.Context(), server.DiscordGuildID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to check guild quota")
				return
			}
			var usedCount, remaining int32 = 0, 1
			if used {
				usedCount, remaining = 1, 0
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"used":      usedCount,
				"limit":     int32(1),
				"tier":      "free",
				"remaining": remaining,
			})
			return
		}

		// Pro: per-month on-demand soft cap (drafts also generate on Sunday schedule).
		used, err := s.Queries.CountOnDemandThisMonth(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to count on-demand generations")
			return
		}
		const proLimit int32 = 10
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"used":      used,
			"limit":     proLimit,
			"tier":      "pro",
			"remaining": proLimit - used,
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

		writeJSON(w, http.StatusOK, projectNewsletter(nl))
	}
}

// projectNewsletter rewrites the bare sqlc Newsletter into a JSON
// shape the frontend can consume: sources arrives as JSON-encoded
// JSONB ([]byte) and would otherwise emit as base64; we splice it
// in as json.RawMessage so it round-trips as-is.
func projectNewsletter(nl db.Newsletter) map[string]any {
	var sources json.RawMessage
	if len(nl.Sources) > 0 {
		sources = json.RawMessage(nl.Sources)
	} else {
		sources = json.RawMessage("[]")
	}
	return map[string]any{
		"id":               nl.ID,
		"server_id":        nl.ServerID,
		"period_start":     nl.PeriodStart,
		"period_end":       nl.PeriodEnd,
		"status":           nl.Status,
		"draft_markdown":   nl.DraftMarkdown,
		"edited_markdown":  textOrEmpty(nl.EditedMarkdown),
		"published_at":     nl.PublishedAt,
		"published_url":    textOrEmpty(nl.PublishedUrl),
		"cost_usd":         nl.CostUsd,
		"pass1_tokens_in":  nl.Pass1TokensIn,
		"pass1_tokens_out": nl.Pass1TokensOut,
		"pass2_tokens_in":  nl.Pass2TokensIn,
		"pass2_tokens_out": nl.Pass2TokensOut,
		"error_message":    textOrEmpty(nl.ErrorMessage),
		"created_at":       nl.CreatedAt,
		"updated_at":       nl.UpdatedAt,
		"is_on_demand":     nl.IsOnDemand,
		"sources":          sources,
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
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB cap

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

		if len(req.EditedMarkdown) > 200000 {
			writeError(w, http.StatusBadRequest, "newsletter too long")
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
		// must subscribe to ship it. Admins bypass.
		if !s.isAdminUUID(userID) {
			user, err := s.Queries.GetUserByID(r.Context(), userID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get user")
				return
			}
			if user.SubscriptionStatus != "active" {
				writeError(w, http.StatusPaymentRequired, "subscribe to publish newsletters")
				return
			}
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
		switch req.Platform {
		case "beehiiv", "convertkit", "ghost":
			// ok
		default:
			writeError(w, http.StatusBadRequest, "unsupported platform")
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
