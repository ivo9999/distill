package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sislelabs/distill/apps/api/internal/config"
	"github.com/sislelabs/distill/apps/api/internal/db"
	"github.com/sislelabs/distill/apps/api/internal/discord"
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

	bot, err := discord.New(cfg.DiscordBotToken, pool, queries, cfg.AppBaseURL, cfg.DiscordClientID)
	if err != nil {
		slog.Error("failed to create bot", "err", err)
		os.Exit(1)
	}

	if err := bot.Start(); err != nil {
		slog.Error("failed to start bot", "err", err)
		os.Exit(1)
	}

	slog.Info("discord bot is running")

	// Wait for shutdown signal.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	slog.Info("shutting down bot")
	_ = bot.Stop()
}
