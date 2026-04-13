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

func listServers(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		servers, err := s.Queries.ListServersByUserID(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list servers")
			return
		}

		writeJSON(w, http.StatusOK, servers)
	}
}

func getServer(s *Server) http.HandlerFunc {
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

		// Verify ownership.
		if server.UserID != userID {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		writeJSON(w, http.StatusOK, server)
	}
}

type updateServerRequest struct {
	Name          string `json:"name"`
	CommunityType string `json:"community_type"`
	ScheduleCron  string `json:"schedule_cron"`
	Status        string `json:"status"`
}

func updateServer(s *Server) http.HandlerFunc {
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
		existing, err := s.Queries.GetServerByID(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusNotFound, "server not found")
			return
		}
		if existing.UserID != userID {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		var req updateServerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		communityType := pgtype.Text{Valid: false}
		if req.CommunityType != "" {
			communityType = pgtype.Text{String: req.CommunityType, Valid: true}
		}
		scheduleCron := existing.ScheduleCron
		if req.ScheduleCron != "" {
			scheduleCron = req.ScheduleCron
		}
		status := existing.Status
		if req.Status != "" {
			status = req.Status
		}
		name := existing.Name
		if req.Name != "" {
			name = req.Name
		}

		updated, err := s.Queries.UpdateServer(r.Context(), db.UpdateServerParams{
			ID:            serverID,
			CommunityType: communityType,
			ScheduleCron:  scheduleCron,
			Status:        status,
			Name:          name,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update server")
			return
		}

		writeJSON(w, http.StatusOK, updated)
	}
}

func triggerGenerate(s *Server) http.HandlerFunc {
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

		if s.RiverClient == nil {
			writeError(w, http.StatusServiceUnavailable, "job queue not available")
			return
		}

		_, err = s.RiverClient.Insert(r.Context(), jobs.GenerateNewsletterArgs{
			ServerID: serverID,
		}, nil)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to enqueue generation")
			return
		}

		writeJSON(w, http.StatusAccepted, map[string]string{"status": "queued"})
	}
}

// Channel handlers

func listChannels(s *Server) http.HandlerFunc {
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

		channels, err := s.Queries.ListMonitoredChannels(r.Context(), serverID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list channels")
			return
		}

		writeJSON(w, http.StatusOK, channels)
	}
}

type addChannelRequest struct {
	DiscordChannelID string `json:"discord_channel_id"`
	Name             string `json:"name"`
}

func addChannel(s *Server) http.HandlerFunc {
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

		var req addChannelRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.DiscordChannelID == "" || req.Name == "" {
			writeError(w, http.StatusBadRequest, "discord_channel_id and name are required")
			return
		}

		ch, err := s.Queries.AddMonitoredChannel(r.Context(), db.AddMonitoredChannelParams{
			ServerID:         serverID,
			DiscordChannelID: req.DiscordChannelID,
			Name:             req.Name,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to add channel")
			return
		}

		writeJSON(w, http.StatusCreated, ch)
	}
}

func removeChannel(s *Server) http.HandlerFunc {
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

		channelID := chi.URLParam(r, "channelID")

		err = s.Queries.DeleteMonitoredChannel(r.Context(), db.DeleteMonitoredChannelParams{
			ServerID:         serverID,
			DiscordChannelID: channelID,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to remove channel")
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}
