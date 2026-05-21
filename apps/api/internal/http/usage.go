package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/sislelabs/distill/apps/api/internal/auth"
	"github.com/sislelabs/distill/apps/api/internal/db"
)

// usageLimits is the per-day cap for each rate-limited operation kind.
// Keys are the {kind} path parameter values the web proxy sends.
var usageLimits = map[string]int32{
	"regenerate_section": 20,
	"subject_lines":      10,
}

// claimUsage atomically increments today's counter for (caller, kind)
// and returns 200 if the caller is within the per-day limit, or 429 if
// the limit is now exceeded. The web proxy calls this BEFORE running an
// expensive LLM operation so a tight loop cannot run up the bill.
//
// The increment happens regardless of whether the limit is exceeded —
// that is intentional: a rejected attempt still counts, so a caller
// hammering the endpoint cannot get free retries by being over-limit.
func claimUsage(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		kind := chi.URLParam(r, "kind")
		limit, known := usageLimits[kind]
		if !known {
			writeError(w, http.StatusBadRequest, "unknown usage kind")
			return
		}
		count, err := s.Queries.IncrementUsageCounter(r.Context(), db.IncrementUsageCounterParams{
			UserID: userID,
			Kind:   kind,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to record usage")
			return
		}
		if count > limit {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{
				"error": "daily limit reached for this action — try again tomorrow",
				"limit": limit,
				"used":  count,
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"limit":     limit,
			"used":      count,
			"remaining": limit - count,
		})
	}
}
