package main

import (
	"context"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/stripe/stripe-go/v81"

	"github.com/sislelabs/distill/apps/api/internal/config"
	"github.com/sislelabs/distill/apps/api/internal/db"
	apphttp "github.com/sislelabs/distill/apps/api/internal/http"
	"github.com/sislelabs/distill/apps/api/internal/llmclient"

	"net/http"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "err", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	queries := db.New(pool)
	llm := llmclient.New(cfg.WebInternalBaseURL, cfg.InternalAPIKey)

	// Set Stripe API key once at startup.
	stripe.Key = cfg.StripeSecretKey

	// Create a River client for job insertion (no workers needed in the API binary).
	riverClient, err := river.NewClient(riverpgxv5.New(pool), &river.Config{})
	if err != nil {
		slog.Error("failed to create river client", "err", err)
		os.Exit(1)
	}

	srv := &apphttp.Server{
		Queries:     queries,
		Pool:        pool,
		Config:      cfg,
		LLM:         llm,
		RiverClient: riverClient,
	}

	router := apphttp.NewRouter(srv)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	httpServer := &http.Server{
		Addr:         net.JoinHostPort("", port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown.
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		slog.Info("shutting down HTTP server")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = httpServer.Shutdown(shutdownCtx)
		cancel()
	}()

	slog.Info("starting HTTP server", "addr", httpServer.Addr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("HTTP server error", "err", err)
		os.Exit(1)
	}
}
