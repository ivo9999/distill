package jobs

import (
	"context"
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
	Queries *db.Queries
	LLM     *llmclient.Client
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

	// Convert db messages to llmclient messages.
	llmMsgs := make([]llmclient.Message, 0, len(messages))
	for _, m := range messages {
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
		})
	}

	communityType := "general"
	if server.CommunityType.Valid && server.CommunityType.String != "" {
		communityType = server.CommunityType.String
	}

	resp, err := w.LLM.Generate(ctx, llmclient.GenerateRequest{
		CommunityType: communityType,
		ServerName:    server.Name,
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

	_, err = w.Queries.CreateNewsletter(ctx, db.CreateNewsletterParams{
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

	slog.Info("newsletter generated", "server_id", serverID, "messages", len(messages))
	return nil
}
