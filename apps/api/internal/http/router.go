package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"

	"github.com/sislelabs/distill/apps/api/internal/auth"
	"github.com/sislelabs/distill/apps/api/internal/config"
	"github.com/sislelabs/distill/apps/api/internal/db"
	"github.com/sislelabs/distill/apps/api/internal/llmclient"
	"github.com/sislelabs/distill/apps/api/internal/ratelimit"
)

// Server holds dependencies for the HTTP handlers.
type Server struct {
	Queries       *db.Queries
	Pool          *pgxpool.Pool
	Config        *config.Config
	LLM           *llmclient.Client
	RiverClient   *river.Client[pgx.Tx]
	RateLimiter   *ratelimit.Limiter
}

// NewRouter creates a chi router with all routes registered.
func NewRouter(s *Server) http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(s.corsMiddleware)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Stripe webhook (no auth)
	r.Post("/api/webhooks/stripe", stripeWebhookHandler(s))

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(auth.Middleware)
		r.Use(s.RateLimiter.Middleware)

		// Users
		r.Get("/api/me", getMe(s))
		r.Delete("/api/me", deleteMe(s))

		// Servers
		r.Get("/api/servers", listServers(s))
		r.Post("/api/servers", createServer(s))
		r.Get("/api/servers/{serverID}", getServer(s))
		r.Patch("/api/servers/{serverID}", updateServer(s))
		r.Delete("/api/servers/{serverID}", deleteServer(s))
		r.Post("/api/servers/{serverID}/generate", triggerGenerate(s))
		r.Get("/api/servers/{serverID}/messages", listMessages(s))
		r.Get("/api/servers/{serverID}/generation-quota", getGenerationQuota(s))

		// Channels
		r.Get("/api/servers/{serverID}/channels", listChannels(s))
		r.Post("/api/servers/{serverID}/channels", addChannel(s))
		r.Patch("/api/servers/{serverID}/channels/{channelID}", updateChannel(s))
		r.Delete("/api/servers/{serverID}/channels/{channelID}", removeChannel(s))

		// Newsletters
		r.Post("/api/servers/{serverID}/newsletters", createNewsletter(s))
		r.Get("/api/servers/{serverID}/newsletters", listNewsletters(s))
		r.Get("/api/newsletters/{newsletterID}", getNewsletter(s))
		r.Patch("/api/newsletters/{newsletterID}", updateNewsletter(s))
		r.Post("/api/newsletters/{newsletterID}/publish", publishNewsletter(s))

		// Integrations
		r.Get("/api/integrations", listIntegrations(s))
		r.Post("/api/integrations", connectIntegration(s))
		r.Delete("/api/integrations/{platform}", disconnectIntegration(s))

		// Billing
		r.Post("/api/billing/checkout", createCheckout(s))
		r.Post("/api/billing/portal", createPortal(s))

		// Usage quota
		r.Post("/api/usage/{kind}", claimUsage(s))

		// Admin
		r.Get("/api/admin/dashboard", adminDashboard(s))
	})

	return r
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	origin := s.Config.AppBaseURL
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
