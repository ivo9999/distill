package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sislelabs/distill/apps/api/internal/auth"
	"github.com/sislelabs/distill/apps/api/internal/db"
	"github.com/sislelabs/distill/apps/api/internal/jobs"
)

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
