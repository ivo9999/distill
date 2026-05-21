package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sislelabs/distill/apps/api/internal/auth"
	"github.com/sislelabs/distill/apps/api/internal/config"
	"github.com/sislelabs/distill/apps/api/internal/db"
)

func listIntegrations(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		conns, err := s.Queries.ListPublisherConnections(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list integrations")
			return
		}

		// Strip encrypted keys from the response.
		type safeConn struct {
			ID            pgtype.UUID        `json:"id"`
			Platform      string             `json:"platform"`
			PublicationID pgtype.Text        `json:"publication_id"`
			CreatedAt     pgtype.Timestamptz `json:"created_at"`
		}
		result := make([]safeConn, 0, len(conns))
		for _, c := range conns {
			result = append(result, safeConn{
				ID:            c.ID,
				Platform:      c.Platform,
				PublicationID: c.PublicationID,
				CreatedAt:     c.CreatedAt,
			})
		}

		writeJSON(w, http.StatusOK, result)
	}
}

type connectIntegrationRequest struct {
	Platform      string `json:"platform"`
	APIKey        string `json:"api_key"`
	PublicationID string `json:"publication_id"`
}

func connectIntegration(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB cap

		var req connectIntegrationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Platform == "" || req.APIKey == "" {
			writeError(w, http.StatusBadRequest, "platform and api_key are required")
			return
		}

		encrypted, err := config.Encrypt(req.APIKey, s.Config.EncryptionKey)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to encrypt API key")
			return
		}

		pubID := pgtype.Text{Valid: false}
		if req.PublicationID != "" {
			pubID = pgtype.Text{String: req.PublicationID, Valid: true}
		}

		conn, err := s.Queries.UpsertPublisherConnection(r.Context(), db.UpsertPublisherConnectionParams{
			UserID:          userID,
			Platform:        req.Platform,
			ApiKeyEncrypted: encrypted,
			PublicationID:   pubID,
			Metadata:        []byte("{}"),
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save integration")
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"id":       conn.ID,
			"platform": conn.Platform,
		})
	}
}

func disconnectIntegration(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		platform := chi.URLParam(r, "platform")
		if platform == "" {
			writeError(w, http.StatusBadRequest, "platform is required")
			return
		}

		err := s.Queries.DeletePublisherConnection(r.Context(), db.DeletePublisherConnectionParams{
			UserID:   userID,
			Platform: platform,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to disconnect integration")
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
