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
)

// Server holds dependencies for the HTTP handlers.
type Server struct {
	Queries       *db.Queries
	Pool          *pgxpool.Pool
	Config        *config.Config
	LLM           *llmclient.Client
	RiverClient   *river.Client[pgx.Tx]
}

// NewRouter creates a chi router with all routes registered.
func NewRouter(s *Server) http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(corsMiddleware)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Stripe webhook (no auth)
	r.Post("/api/webhooks/stripe", stripeWebhookHandler(s))

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(auth.Middleware)

		// Users
		r.Get("/api/me", getMe(s))

		// Servers
		r.Get("/api/servers", listServers(s))
		r.Get("/api/servers/{serverID}", getServer(s))
		r.Put("/api/servers/{serverID}", updateServer(s))
		r.Post("/api/servers/{serverID}/generate", triggerGenerate(s))

		// Channels
		r.Get("/api/servers/{serverID}/channels", listChannels(s))
		r.Post("/api/servers/{serverID}/channels", addChannel(s))
		r.Delete("/api/servers/{serverID}/channels/{channelID}", removeChannel(s))

		// Newsletters
		r.Get("/api/servers/{serverID}/newsletters", listNewsletters(s))
		r.Get("/api/newsletters/{newsletterID}", getNewsletter(s))
		r.Put("/api/newsletters/{newsletterID}", updateNewsletter(s))
		r.Post("/api/newsletters/{newsletterID}/publish", publishNewsletter(s))

		// Integrations
		r.Get("/api/integrations", listIntegrations(s))
		r.Post("/api/integrations", connectIntegration(s))
		r.Delete("/api/integrations/{platform}", disconnectIntegration(s))

		// Billing
		r.Post("/api/billing/checkout", createCheckout(s))
		r.Post("/api/billing/portal", createPortal(s))
	})

	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
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
