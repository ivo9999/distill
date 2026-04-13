package discord

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/bwmarrin/discordgo"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

// contextFromInteraction returns a background context with timeout for event handlers.
func contextFromInteraction() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 10*time.Second)
}

func (b *Bot) onMessageCreate(s *discordgo.Session, m *discordgo.MessageCreate) {
	if m.Author == nil || m.Author.Bot {
		return
	}
	if m.GuildID == "" {
		return
	}

	ctx, cancel := contextFromInteraction()
	defer cancel()

	// Check if channel is monitored.
	row, err := b.queries.GetServerAndChannelByDiscordIDs(ctx, db.GetServerAndChannelByDiscordIDsParams{
		DiscordGuildID:   m.GuildID,
		DiscordChannelID: m.ChannelID,
	})
	if err != nil {
		// Channel not monitored — ignore.
		return
	}

	// Check if user is opted out.
	optedOut, err := b.queries.IsUserOptedOut(ctx, db.IsUserOptedOutParams{
		ServerID:      row.ServerID,
		DiscordUserID: m.Author.ID,
	})
	if err != nil {
		slog.Error("failed to check opt-out", "err", err)
		return
	}
	if optedOut {
		return
	}

	sentAt := pgtype.Timestamptz{Time: m.Timestamp, Valid: true}
	if m.Timestamp.IsZero() {
		sentAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
	}

	replyTo := pgtype.Text{Valid: false}
	if m.MessageReference != nil && m.MessageReference.MessageID != "" {
		replyTo = pgtype.Text{String: m.MessageReference.MessageID, Valid: true}
	}

	threadID := pgtype.Text{Valid: false}
	if m.Thread != nil {
		threadID = pgtype.Text{String: m.Thread.ID, Valid: true}
	}

	displayName := m.Author.Username
	if m.Member != nil && m.Member.Nick != "" {
		displayName = m.Member.Nick
	}

	rawPayload, _ := json.Marshal(m.Message)

	err = b.queries.InsertMessage(ctx, db.InsertMessageParams{
		DiscordMessageID:  m.ID,
		ServerID:          row.ServerID,
		ChannelID:         row.ChannelID,
		DiscordAuthorID:   m.Author.ID,
		AuthorDisplayName: displayName,
		Content:           m.Content,
		ReplyToDiscordID:  replyTo,
		ThreadDiscordID:   threadID,
		SentAt:            sentAt,
		ReactionCount:     0,
		ReplyCount:        0,
		RawPayload:        rawPayload,
	})
	if err != nil {
		slog.Error("failed to insert message", "discord_message_id", m.ID, "err", err)
	}
}

func (b *Bot) onMessageUpdate(s *discordgo.Session, m *discordgo.MessageUpdate) {
	if m.Author == nil || m.Author.Bot {
		return
	}
	if m.GuildID == "" || m.Content == "" {
		return
	}

	ctx, cancel := contextFromInteraction()
	defer cancel()

	err := b.queries.UpdateMessageContent(ctx, db.UpdateMessageContentParams{
		DiscordMessageID: m.ID,
		Content:          m.Content,
	})
	if err != nil {
		slog.Error("failed to update message", "discord_message_id", m.ID, "err", err)
	}
}

func (b *Bot) onMessageDelete(s *discordgo.Session, m *discordgo.MessageDelete) {
	ctx, cancel := contextFromInteraction()
	defer cancel()

	err := b.queries.SoftDeleteMessage(ctx, m.ID)
	if err != nil {
		slog.Error("failed to soft-delete message", "discord_message_id", m.ID, "err", err)
	}
}

func (b *Bot) onMessageReactionAdd(s *discordgo.Session, r *discordgo.MessageReactionAdd) {
	ctx, cancel := contextFromInteraction()
	defer cancel()

	err := b.queries.IncrementReactionCount(ctx, r.MessageID)
	if err != nil {
		slog.Error("failed to increment reaction count", "discord_message_id", r.MessageID, "err", err)
	}
}

func (b *Bot) onGuildDelete(s *discordgo.Session, g *discordgo.GuildDelete) {
	ctx, cancel := contextFromInteraction()
	defer cancel()

	err := b.queries.SetServerRemoved(ctx, g.ID)
	if err != nil {
		slog.Error("failed to mark server removed", "guild_id", g.ID, "err", err)
	}
	slog.Info("server removed (bot kicked or guild deleted)", "guild_id", g.ID)
}
