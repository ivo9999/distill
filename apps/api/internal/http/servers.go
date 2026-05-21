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

type createServerRequest struct {
	DiscordGuildID string `json:"discord_guild_id"`
	Name           string `json:"name"`
	IconURL        string `json:"icon_url"`
	CommunityType  string `json:"community_type"`
}

func createServer(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		var req createServerRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.DiscordGuildID == "" || req.Name == "" {
			writeError(w, http.StatusBadRequest, "discord_guild_id and name are required")
			return
		}

		iconURL := pgtype.Text{Valid: false}
		if req.IconURL != "" {
			iconURL = pgtype.Text{String: req.IconURL, Valid: true}
		}
		communityType := pgtype.Text{Valid: false}
		if req.CommunityType != "" {
			communityType = pgtype.Text{String: req.CommunityType, Valid: true}
		}

		server, err := s.Queries.CreateServer(r.Context(), db.CreateServerParams{
			UserID:         userID,
			DiscordGuildID: req.DiscordGuildID,
			Name:           req.Name,
			IconUrl:        iconURL,
			CommunityType:  communityType,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create server")
			return
		}

		writeJSON(w, http.StatusCreated, server)
	}
}

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

		// Project to a stable JSON shape. The bare sqlc model exposes
		// pgtype.Text as {String, Valid}, which the frontend can't
		// parse without per-field unwrapping. This handler is the only
		// reader of GET /api/servers/:id so we own the wire format.
		writeJSON(w, http.StatusOK, map[string]any{
			"id":               server.ID,
			"user_id":          server.UserID,
			"discord_guild_id": server.DiscordGuildID,
			"name":             server.Name,
			"icon_url":         textOrEmpty(server.IconUrl),
			"community_type":   textOrEmpty(server.CommunityType),
			"schedule_cron":    server.ScheduleCron,
			"status":           server.Status,
			"voice_sample":     textOrEmpty(server.VoiceSample),
			"created_at":       server.CreatedAt.Time.Format(time.RFC3339),
		})
	}
}

// deleteServer hard-deletes a server the caller owns. The DB cascade
// (ON DELETE CASCADE on monitored_channels / messages / optouts /
// newsletters) removes all dependent rows. guild_free_generations has
// no FK to servers, so the guild's free-generation record survives —
// re-adding the same Discord guild does not reset the free quota.
func deleteServer(s *Server) http.HandlerFunc {
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

		if err := s.Queries.DeleteServer(r.Context(), serverID); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to delete server")
			return
		}

		writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
	}
}

// textOrEmpty unwraps a pgtype.Text into a plain string ("" when NULL).
// Keeps the JSON wire format predictable for the frontend instead of
// the {String, Valid} object pgtype marshals to by default.
func textOrEmpty(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}

type updateServerRequest struct {
	Name          string `json:"name"`
	CommunityType string `json:"community_type"`
	ScheduleCron  string `json:"schedule_cron"`
	Status        string `json:"status"`
	// Pointer so we can distinguish:
	//   nil      → caller didn't include the field — keep existing
	//   ""       → caller wants to clear it (writes NULL via sentinel)
	//   non-empty → caller wants to set it
	VoiceSample *string `json:"voice_sample,omitempty"`
}

// voiceSampleSentinelClear matches the sentinel the SQL CASE in
// UpdateServer recognizes as "set to NULL." Kept as a Go const so the
// SQL and Go halves can't drift.
const voiceSampleSentinelClear = "__SET_NULL__"

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

		// voice_sample uses the sentinel pattern: omitted → keep,
		// empty string → clear, otherwise → set.
		voiceSample := pgtype.Text{Valid: false}
		if req.VoiceSample != nil {
			if *req.VoiceSample == "" {
				voiceSample = pgtype.Text{String: voiceSampleSentinelClear, Valid: true}
			} else {
				voiceSample = pgtype.Text{String: *req.VoiceSample, Valid: true}
			}
		}

		updated, err := s.Queries.UpdateServer(r.Context(), db.UpdateServerParams{
			ID:            serverID,
			CommunityType: communityType,
			ScheduleCron:  scheduleCron,
			Status:        status,
			Name:          name,
			VoiceSample:   voiceSample,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update server")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"id":               updated.ID,
			"user_id":          updated.UserID,
			"discord_guild_id": updated.DiscordGuildID,
			"name":             updated.Name,
			"icon_url":         textOrEmpty(updated.IconUrl),
			"community_type":   textOrEmpty(updated.CommunityType),
			"schedule_cron":    updated.ScheduleCron,
			"status":           updated.Status,
			"voice_sample":     textOrEmpty(updated.VoiceSample),
			"created_at":       updated.CreatedAt.Time.Format(time.RFC3339),
		})
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

		// Free-tier gate (manual triggers count as on-demand). Admins bypass.
		if !s.isAdminUUID(userID) {
			user, err := s.Queries.GetUserByID(r.Context(), userID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to get user")
				return
			}
			if user.SubscriptionStatus != "active" {
				used, err := s.Queries.GuildFreeGenerationUsed(r.Context(), server.DiscordGuildID)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "failed to check guild quota")
					return
				}
				if used {
					writeError(w, http.StatusPaymentRequired, "free tier limit reached: subscribe to generate more")
					return
				}
			}
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

func listMessages(s *Server) http.HandlerFunc {
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

		now := time.Now()
		oneWeekAgo := now.AddDate(0, 0, -7)

		var start, end pgtype.Timestamptz
		start.Time = oneWeekAgo
		start.Valid = true
		end.Time = now
		end.Valid = true

		messages, err := s.Queries.GetMessagesForGeneration(r.Context(), db.GetMessagesForGenerationParams{
			ServerID: serverID,
			SentAt:   start,
			SentAt_2: end,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list messages")
			return
		}

		// Build channel name + discord_id + weight lookup. Weight is
		// exposed per message so the TS pipeline can scale
		// engagement_signal at rank time without a second round-trip;
		// discord_channel_id is exposed so the editor can build
		// permalinks of the form discord.com/channels/<g>/<c>/<m>.
		channels, _ := s.Queries.ListMonitoredChannels(r.Context(), serverID)
		type chInfo struct {
			name      string
			discordID string
			weight    float64
		}
		channelByID := make(map[string]chInfo)
		for _, ch := range channels {
			uid := fmt.Sprintf("%x-%x-%x-%x-%x",
				ch.ID.Bytes[0:4], ch.ID.Bytes[4:6], ch.ID.Bytes[6:8], ch.ID.Bytes[8:10], ch.ID.Bytes[10:16])
			channelByID[uid] = chInfo{
				name:      ch.Name,
				discordID: ch.DiscordChannelID,
				weight:    numericToFloat(ch.Weight, 1.0),
			}
		}

		type messageResponse struct {
			ID               string  `json:"id"`
			AuthorID         string  `json:"author_id"`
			AuthorName       string  `json:"author_name"`
			Content          string  `json:"content"`
			Timestamp        string  `json:"timestamp"`
			ReactionCount    int32   `json:"reaction_count"`
			ReplyCount       int32   `json:"reply_count"`
			ReplyToID        string  `json:"reply_to_id,omitempty"`
			ThreadID         string  `json:"thread_id,omitempty"`
			ChannelName      string  `json:"channel_name"`
			ChannelWeight    float64 `json:"channel_weight"`
			DiscordChannelID string  `json:"discord_channel_id"`
		}

		resp := make([]messageResponse, 0, len(messages))
		for _, m := range messages {
			chID := fmt.Sprintf("%x-%x-%x-%x-%x",
				m.ChannelID.Bytes[0:4], m.ChannelID.Bytes[4:6], m.ChannelID.Bytes[6:8], m.ChannelID.Bytes[8:10], m.ChannelID.Bytes[10:16])
			info := channelByID[chID]
			if info.weight == 0 {
				info.weight = 1.0
			}
			mr := messageResponse{
				ID:               m.DiscordMessageID,
				AuthorID:         m.DiscordAuthorID,
				AuthorName:       m.AuthorDisplayName,
				Content:          m.Content,
				Timestamp:        m.SentAt.Time.Format(time.RFC3339),
				ReactionCount:    m.ReactionCount,
				ReplyCount:       m.ReplyCount,
				ChannelName:      info.name,
				ChannelWeight:    info.weight,
				DiscordChannelID: info.discordID,
			}
			if m.ReplyToDiscordID.Valid {
				mr.ReplyToID = m.ReplyToDiscordID.String
			}
			if m.ThreadDiscordID.Valid {
				mr.ThreadID = m.ThreadDiscordID.String
			}
			resp = append(resp, mr)
		}

		writeJSON(w, http.StatusOK, resp)
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

		// Project channels into a stable JSON shape with weight as a
		// float64 (instead of pgtype.Numeric, which JSON-encodes as an
		// object the frontend can't easily read). The default weight is
		// 1.0 — older rows without an explicit Set will surface that.
		type channelResponse struct {
			ID               pgtype.UUID `json:"id"`
			ServerID         pgtype.UUID `json:"server_id"`
			DiscordChannelID string      `json:"discord_channel_id"`
			Name             string      `json:"name"`
			Weight           float64     `json:"weight"`
			CreatedAt        string      `json:"created_at"`
		}
		resp := make([]channelResponse, 0, len(channels))
		for _, ch := range channels {
			resp = append(resp, channelResponse{
				ID:               ch.ID,
				ServerID:         ch.ServerID,
				DiscordChannelID: ch.DiscordChannelID,
				Name:             ch.Name,
				Weight:           numericToFloat(ch.Weight, 1.0),
				CreatedAt:        ch.CreatedAt.Time.Format(time.RFC3339),
			})
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// numericToFloat converts a pgtype.Numeric (the sqlc-generated mapping
// for NUMERIC) to a float64 suitable for JSON. Falls back to def on
// any decode failure rather than 0 — callers that care about an
// explicit zero should check Valid themselves.
func numericToFloat(n pgtype.Numeric, def float64) float64 {
	if !n.Valid {
		return def
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return def
	}
	return f.Float64
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

		// Enqueue a backfill job for the newly added channel.
		if s.RiverClient != nil {
			_, _ = s.RiverClient.Insert(r.Context(), jobs.BackfillChannelArgs{
				ServerID:         serverID,
				ChannelID:        ch.ID,
				DiscordChannelID: req.DiscordChannelID,
				DiscordGuildID:   server.DiscordGuildID,
			}, nil)
		}

		writeJSON(w, http.StatusCreated, ch)
	}
}

type updateChannelRequest struct {
	// Pointer so the handler can distinguish "field omitted from body"
	// from "weight explicitly set to 0". We only persist when non-nil.
	Weight *float64 `json:"weight,omitempty"`
}

// updateChannel — partial update of a monitored channel. Today it
// only supports `weight`, but the body is shaped as a partial so
// future fields (e.g. per-channel community-type override) can be
// added without breaking the route shape.
//
// Clamps the weight to [0.1, 5.0]. The UI only exposes three presets
// (0.5 / 1.0 / 2.0) but the API is permissive enough that we can
// experiment with finer-grained values later without a server bump.
func updateChannel(s *Server) http.HandlerFunc {
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

		var req updateChannelRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Weight == nil {
			writeError(w, http.StatusBadRequest, "no fields to update")
			return
		}

		weight := *req.Weight
		if weight < 0.1 {
			weight = 0.1
		}
		if weight > 5.0 {
			weight = 5.0
		}

		var weightNum pgtype.Numeric
		if err := weightNum.Scan(fmt.Sprintf("%.2f", weight)); err != nil {
			writeError(w, http.StatusBadRequest, "invalid weight")
			return
		}

		ch, err := s.Queries.UpdateMonitoredChannelWeight(r.Context(), db.UpdateMonitoredChannelWeightParams{
			ServerID:         serverID,
			DiscordChannelID: chi.URLParam(r, "channelID"),
			Weight:           weightNum,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update channel")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"id":                 ch.ID,
			"discord_channel_id": ch.DiscordChannelID,
			"name":               ch.Name,
			"weight":             numericToFloat(ch.Weight, 1.0),
		})
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
