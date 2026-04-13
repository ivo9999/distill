package jobs

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/riverqueue/river"

	"github.com/sislelabs/distill/apps/api/internal/config"
	"github.com/sislelabs/distill/apps/api/internal/db"
	"github.com/sislelabs/distill/apps/api/internal/llmclient"
)

// PublishNewsletterArgs are the arguments for the publish newsletter job.
type PublishNewsletterArgs struct {
	NewsletterID pgtype.UUID `json:"newsletter_id"`
	UserID       pgtype.UUID `json:"user_id"`
	Platform     string      `json:"platform"`
	Subject      string      `json:"subject"`
}

func (PublishNewsletterArgs) Kind() string { return "publish_newsletter" }

// PublishNewsletterWorker publishes a newsletter to an external platform.
type PublishNewsletterWorker struct {
	river.WorkerDefaults[PublishNewsletterArgs]
	Queries       *db.Queries
	LLM           *llmclient.Client
	EncryptionKey string
}

func (w *PublishNewsletterWorker) Work(ctx context.Context, job *river.Job[PublishNewsletterArgs]) error {
	args := job.Args

	newsletter, err := w.Queries.GetNewsletterByID(ctx, args.NewsletterID)
	if err != nil {
		return fmt.Errorf("loading newsletter: %w", err)
	}

	// Update status to publishing.
	err = w.Queries.UpdateNewsletterStatus(ctx, db.UpdateNewsletterStatusParams{
		ID:           args.NewsletterID,
		Status:       "publishing",
		ErrorMessage: pgtype.Text{Valid: false},
	})
	if err != nil {
		return fmt.Errorf("updating status to publishing: %w", err)
	}

	conn, err := w.Queries.GetPublisherConnection(ctx, db.GetPublisherConnectionParams{
		UserID:   args.UserID,
		Platform: args.Platform,
	})
	if err != nil {
		w.setError(ctx, args.NewsletterID, "publisher connection not found")
		return fmt.Errorf("loading publisher connection: %w", err)
	}

	apiKey, err := config.Decrypt(conn.ApiKeyEncrypted, w.EncryptionKey)
	if err != nil {
		w.setError(ctx, args.NewsletterID, "failed to decrypt API key")
		return fmt.Errorf("decrypting API key: %w", err)
	}

	// Use edited markdown if available, otherwise use draft.
	markdown := newsletter.DraftMarkdown
	if newsletter.EditedMarkdown.Valid && newsletter.EditedMarkdown.String != "" {
		markdown = newsletter.EditedMarkdown.String
	}

	pubReq := llmclient.PublishRequest{
		Markdown: markdown,
		Subject:  args.Subject,
		Platform: args.Platform,
		APIKey:   apiKey,
	}
	if conn.PublicationID.Valid {
		pubReq.PublicationID = conn.PublicationID.String
	}

	resp, err := w.LLM.Publish(ctx, pubReq)
	if err != nil {
		w.setError(ctx, args.NewsletterID, err.Error())
		return fmt.Errorf("publishing newsletter: %w", err)
	}

	err = w.Queries.UpdateNewsletterPublished(ctx, db.UpdateNewsletterPublishedParams{
		ID:           args.NewsletterID,
		PublishedUrl: pgtype.Text{String: resp.PublishedURL, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("updating published status: %w", err)
	}

	slog.Info("newsletter published", "newsletter_id", args.NewsletterID, "url", resp.PublishedURL)
	return nil
}

func (w *PublishNewsletterWorker) setError(ctx context.Context, id pgtype.UUID, msg string) {
	err := w.Queries.UpdateNewsletterStatus(ctx, db.UpdateNewsletterStatusParams{
		ID:           id,
		Status:       "error",
		ErrorMessage: pgtype.Text{String: msg, Valid: true},
	})
	if err != nil {
		slog.Error("failed to set newsletter error status", "err", err)
	}
}
