package jobs

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/riverqueue/river"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

// DiscordFetcher abstracts fetching channel message history from Discord.
type DiscordFetcher interface {
	FetchChannelHistory(ctx context.Context, channelID string, limit int) ([]DiscordMessage, error)
}

// DiscordMessage represents a message fetched from the Discord API.
type DiscordMessage struct {
	ID                string
	AuthorID          string
	AuthorDisplayName string
	Content           string
	Timestamp         string
	ReactionCount     int
	ReplyCount        int
	ReplyToID         string
	ThreadID          string
	RawPayload        []byte
}

// BackfillChannelArgs are the arguments for the backfill channel job.
type BackfillChannelArgs struct {
	ServerID         pgtype.UUID `json:"server_id"`
	ChannelID        pgtype.UUID `json:"channel_id"`
	DiscordChannelID string      `json:"discord_channel_id"`
	DiscordGuildID   string      `json:"discord_guild_id"`
}

func (BackfillChannelArgs) Kind() string { return "backfill_channel" }

// BackfillChannelWorker backfills message history for a channel.
type BackfillChannelWorker struct {
	river.WorkerDefaults[BackfillChannelArgs]
	Queries *db.Queries
	Fetcher DiscordFetcher
}

func (w *BackfillChannelWorker) Work(ctx context.Context, job *river.Job[BackfillChannelArgs]) error {
	args := job.Args

	// Get opted-out users for this server.
	optedOut, err := w.Queries.ListOptouts(ctx, args.ServerID)
	if err != nil {
		return fmt.Errorf("listing optouts: %w", err)
	}
	optoutSet := make(map[string]bool, len(optedOut))
	for _, uid := range optedOut {
		optoutSet[uid] = true
	}

	messages, err := w.Fetcher.FetchChannelHistory(ctx, args.DiscordChannelID, 500)
	if err != nil {
		return fmt.Errorf("fetching channel history: %w", err)
	}

	inserted := 0
	for _, m := range messages {
		if optoutSet[m.AuthorID] {
			continue
		}

		var sentAt pgtype.Timestamptz
		_ = sentAt.Scan(m.Timestamp)

		replyTo := pgtype.Text{Valid: false}
		if m.ReplyToID != "" {
			replyTo = pgtype.Text{String: m.ReplyToID, Valid: true}
		}
		threadID := pgtype.Text{Valid: false}
		if m.ThreadID != "" {
			threadID = pgtype.Text{String: m.ThreadID, Valid: true}
		}

		err := w.Queries.InsertMessage(ctx, db.InsertMessageParams{
			DiscordMessageID:  m.ID,
			ServerID:          args.ServerID,
			ChannelID:         args.ChannelID,
			DiscordAuthorID:   m.AuthorID,
			AuthorDisplayName: m.AuthorDisplayName,
			Content:           m.Content,
			ReplyToDiscordID:  replyTo,
			ThreadDiscordID:   threadID,
			SentAt:            sentAt,
			ReactionCount:     int32(m.ReactionCount),
			ReplyCount:        int32(m.ReplyCount),
			RawPayload:        m.RawPayload,
		})
		if err != nil {
			slog.Warn("failed to insert message", "discord_message_id", m.ID, "err", err)
			continue
		}
		inserted++
	}

	slog.Info("backfill complete", "channel_id", args.DiscordChannelID, "fetched", len(messages), "inserted", inserted)
	return nil
}
