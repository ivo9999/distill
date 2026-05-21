package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"

	"github.com/sislelabs/distill/apps/api/internal/config"
	"github.com/sislelabs/distill/apps/api/internal/db"
	"github.com/sislelabs/distill/apps/api/internal/discord"
	"github.com/sislelabs/distill/apps/api/internal/jobs"
	"github.com/sislelabs/distill/apps/api/internal/llmclient"
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

	// Create discord bot for DM sending and fetching.
	bot, err := discord.New(cfg.DiscordBotToken, pool, queries, cfg.AppBaseURL, cfg.DiscordClientID)
	if err != nil {
		slog.Error("failed to create discord bot for worker", "err", err)
		os.Exit(1)
	}
	fetcher := discord.NewFetcher(bot.Session())

	// Create worker instances with dependencies.
	genWorker := &jobs.GenerateNewsletterWorker{
		Queries:    queries,
		LLM:        llm,
		AppBaseURL: cfg.AppBaseURL,
		DMSender:   bot,
	}
	backfillWorker := &jobs.BackfillChannelWorker{
		Queries: queries,
		Fetcher: fetcher,
	}
	publishWorker := &jobs.PublishNewsletterWorker{
		Queries:       queries,
		LLM:           llm,
		EncryptionKey: cfg.EncryptionKey,
	}
	trialWorker := &jobs.TrialReminderWorker{
		Queries:  queries,
		DMSender: bot,
	}
	retentionWorker := &jobs.MessageRetentionWorker{
		Queries: queries,
	}
	// Scheduler worker -- we set the Inserter after creating the client.
	schedWorker := &jobs.SchedulerWorker{
		Queries: queries,
	}

	// Run River migrations.
	migrator, err := rivermigrate.New(riverpgxv5.New(pool), nil)
	if err != nil {
		slog.Error("failed to create river migrator", "err", err)
		os.Exit(1)
	}
	_, err = migrator.Migrate(ctx, rivermigrate.DirectionUp, nil)
	if err != nil {
		slog.Error("failed to run river migrations", "err", err)
		os.Exit(1)
	}

	// Register all workers.
	workers := river.NewWorkers()
	river.AddWorker(workers, genWorker)
	river.AddWorker(workers, backfillWorker)
	river.AddWorker(workers, publishWorker)
	river.AddWorker(workers, trialWorker)
	river.AddWorker(workers, schedWorker)
	river.AddWorker(workers, retentionWorker)

	// Create the River client.
	riverClient, err := river.NewClient(riverpgxv5.New(pool), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault: {MaxWorkers: 10},
		},
		Workers: workers,
		PeriodicJobs: []*river.PeriodicJob{
			river.NewPeriodicJob(
				river.PeriodicInterval(1*time.Hour),
				func() (river.JobArgs, *river.InsertOpts) {
					return jobs.SchedulerArgs{}, nil
				},
				nil,
			),
			river.NewPeriodicJob(
				river.PeriodicInterval(24*time.Hour),
				func() (river.JobArgs, *river.InsertOpts) {
					return jobs.TrialReminderArgs{}, nil
				},
				nil,
			),
			river.NewPeriodicJob(
				river.PeriodicInterval(24*time.Hour),
				func() (river.JobArgs, *river.InsertOpts) {
					return jobs.MessageRetentionArgs{}, nil
				},
				nil,
			),
		},
	})
	if err != nil {
		slog.Error("failed to create river client", "err", err)
		os.Exit(1)
	}

	// Now set the inserter on the scheduler worker.
	schedWorker.Inserter = riverClient

	if err := riverClient.Start(ctx); err != nil {
		slog.Error("failed to start river client", "err", err)
		os.Exit(1)
	}

	slog.Info("worker started")

	// Wait for shutdown signal.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	slog.Info("shutting down worker")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	_ = riverClient.Stop(shutdownCtx)
}
