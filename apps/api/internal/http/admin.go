package http

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sislelabs/distill/apps/api/internal/auth"
)

func (s *Server) isAdmin(userID string) bool {
	for _, id := range s.Config.AdminUserIDs {
		if id == userID {
			return true
		}
	}
	return false
}

// isAdminUUID is a convenience wrapper that formats a pgtype.UUID before checking.
func (s *Server) isAdminUUID(userID pgtype.UUID) bool {
	return s.isAdmin(formatUUID(userID))
}

func adminDashboard(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		if !s.isAdmin(formatUUID(userID)) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		ctx := r.Context()

		userStats, err := s.Queries.AdminGetUserStats(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get user stats")
			return
		}

		newsletterStats, err := s.Queries.AdminGetNewsletterStats(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get newsletter stats")
			return
		}

		serverStats, err := s.Queries.AdminGetServerStats(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get server stats")
			return
		}

		messageStats, err := s.Queries.AdminGetMessageStats(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get message stats")
			return
		}

		recentUsers, err := s.Queries.AdminListRecentUsers(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list recent users")
			return
		}

		recentNewsletters, err := s.Queries.AdminListRecentNewsletters(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list recent newsletters")
			return
		}

		costByDay, err := s.Queries.AdminGetCostByDay(ctx)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to get cost by day")
			return
		}

		writeJSON(w, http.StatusOK, map[string]interface{}{
			"users":               userStats,
			"newsletters":         newsletterStats,
			"servers":             serverStats,
			"messages":            messageStats,
			"recent_users":        recentUsers,
			"recent_newsletters":  recentNewsletters,
			"cost_by_day":         costByDay,
		})
	}
}
