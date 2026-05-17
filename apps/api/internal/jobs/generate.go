package jobs

import (
	"context"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/riverqueue/river"

	"github.com/sislelabs/distill/apps/api/internal/db"
	"github.com/sislelabs/distill/apps/api/internal/llmclient"
)

// GenerateNewsletterArgs are the arguments for the generate newsletter job.
type GenerateNewsletterArgs struct {
	ServerID pgtype.UUID `json:"server_id"`
}

func (GenerateNewsletterArgs) Kind() string { return "generate_newsletter" }

// GenerateNewsletterWorker generates a newsletter for a server.
type GenerateNewsletterWorker struct {
	river.WorkerDefaults[GenerateNewsletterArgs]
	Queries    *db.Queries
	LLM        *llmclient.Client
	AppBaseURL string
	DMSender   DiscordDMSender
}

func (w *GenerateNewsletterWorker) Work(ctx context.Context, job *river.Job[GenerateNewsletterArgs]) error {
	serverID := job.Args.ServerID

	server, err := w.Queries.GetServerByID(ctx, serverID)
	if err != nil {
		return fmt.Errorf("loading server: %w", err)
	}

	// Load user to check subscription.
	user, err := w.Queries.GetUserByID(ctx, server.UserID)
	if err != nil {
		return fmt.Errorf("loading user: %w", err)
	}

	switch user.SubscriptionStatus {
	case "active":
		// OK
	case "trialing":
		if !user.TrialEndsAt.Valid || user.TrialEndsAt.Time.Before(time.Now()) {
			slog.Warn("trial expired, skipping generation", "server_id", serverID, "user_id", user.ID)
			return nil
		}
	default:
		slog.Warn("user subscription not active, skipping", "status", user.SubscriptionStatus)
		return nil
	}

	// Determine period: last 7 days.
	periodEnd := time.Now().UTC()
	periodStart := periodEnd.Add(-7 * 24 * time.Hour)

	messages, err := w.Queries.GetMessagesForGeneration(ctx, db.GetMessagesForGenerationParams{
		ServerID: serverID,
		SentAt:   pgtype.Timestamptz{Time: periodStart, Valid: true},
		SentAt_2: pgtype.Timestamptz{Time: periodEnd, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("fetching messages: %w", err)
	}

	if len(messages) == 0 {
		slog.Info("no messages in period, skipping generation", "server_id", serverID)
		return nil
	}

	// Build a channel weight lookup so each message carries its
	// per-channel weight into the pipeline. Defaulting to 1.0 keeps
	// historical behavior for unweighted channels and rows.
	channels, _ := w.Queries.ListMonitoredChannels(ctx, serverID)
	weightByChannelID := make(map[pgtype.UUID]float64, len(channels))
	for _, ch := range channels {
		w := 1.0
		if ch.Weight.Valid {
			if f, err := ch.Weight.Float64Value(); err == nil && f.Valid {
				w = f.Float64
			}
		}
		weightByChannelID[ch.ID] = w
	}

	// Convert db messages to llmclient messages.
	llmMsgs := make([]llmclient.Message, 0, len(messages))
	for _, m := range messages {
		weight, ok := weightByChannelID[m.ChannelID]
		if !ok {
			weight = 1.0
		}
		llmMsgs = append(llmMsgs, llmclient.Message{
			ID:            m.DiscordMessageID,
			AuthorID:      m.DiscordAuthorID,
			AuthorName:    m.AuthorDisplayName,
			Content:       m.Content,
			Timestamp:     m.SentAt.Time.Format(time.RFC3339),
			ReactionCount: int(m.ReactionCount),
			ReplyCount:    int(m.ReplyCount),
			ReplyToID:     m.ReplyToDiscordID.String,
			ThreadID:      m.ThreadDiscordID.String,
			ChannelWeight: weight,
		})
	}

	communityType := "general"
	if server.CommunityType.Valid && server.CommunityType.String != "" {
		communityType = server.CommunityType.String
	}

	voiceSample := ""
	if server.VoiceSample.Valid {
		voiceSample = server.VoiceSample.String
	}

	resp, err := w.LLM.Generate(ctx, llmclient.GenerateRequest{
		CommunityType: communityType,
		ServerName:    server.Name,
		VoiceSample:   voiceSample,
		Messages:      llmMsgs,
	})
	if err != nil {
		// Save error newsletter.
		var costNum pgtype.Numeric
		_ = costNum.Scan("0")
		errMsg := err.Error()
		_, createErr := w.Queries.CreateNewsletter(ctx, db.CreateNewsletterParams{
			ServerID:       serverID,
			PeriodStart:    pgtype.Timestamptz{Time: periodStart, Valid: true},
			PeriodEnd:      pgtype.Timestamptz{Time: periodEnd, Valid: true},
			Status:         "error",
			DraftMarkdown:  "",
			CostUsd:        costNum,
			Pass1TokensIn:  0,
			Pass1TokensOut: 0,
			Pass2TokensIn:  0,
			Pass2TokensOut: 0,
			ErrorMessage:   pgtype.Text{String: errMsg, Valid: true},
		})
		if createErr != nil {
			slog.Error("failed to save error newsletter", "err", createErr)
		}
		return fmt.Errorf("generating newsletter: %w", err)
	}

	var costNum pgtype.Numeric
	_ = costNum.Scan(fmt.Sprintf("%f", resp.CostUsd))

	nl, err := w.Queries.CreateNewsletter(ctx, db.CreateNewsletterParams{
		ServerID:       serverID,
		PeriodStart:    pgtype.Timestamptz{Time: periodStart, Valid: true},
		PeriodEnd:      pgtype.Timestamptz{Time: periodEnd, Valid: true},
		Status:         "draft",
		DraftMarkdown:  resp.Markdown,
		CostUsd:        costNum,
		Pass1TokensIn:  int32(resp.Pass1TokensIn),
		Pass1TokensOut: int32(resp.Pass1TokensOut),
		Pass2TokensIn:  int32(resp.Pass2TokensIn),
		Pass2TokensOut: int32(resp.Pass2TokensOut),
		ErrorMessage:   pgtype.Text{Valid: false},
	})
	if err != nil {
		return fmt.Errorf("saving newsletter: %w", err)
	}

	// Send a DM to the user notifying them that the draft is ready.
	if w.DMSender != nil {
		link := fmt.Sprintf("%s/dashboard/servers/%s/newsletters/%s", w.AppBaseURL, formatUUID(serverID), formatUUID(nl.ID))
		_ = w.DMSender.SendDM(user.DiscordID, fmt.Sprintf("Your weekly newsletter draft is ready! Review it here: %s", link))
	}

	slog.Info("newsletter generated", "server_id", serverID, "messages", len(messages))
	return nil
}

func formatUUID(id pgtype.UUID) string {
	b := id.Bytes
	s := hex.EncodeToString(b[:])
	return s[:8] + "-" + s[8:12] + "-" + s[12:16] + "-" + s[16:20] + "-" + s[20:]
}
