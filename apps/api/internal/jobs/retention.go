package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/riverqueue/river"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

// messageRetentionDays is how long raw collected Discord messages are
// kept before the retention job deletes them. Surfaced to users in the
// privacy policy and FAQ ("deleted within 30 days") — keep in sync.
const messageRetentionDays = 30

// MessageRetentionArgs are the args for the retention cleanup job
// (periodic, no parameters).
type MessageRetentionArgs struct{}

func (MessageRetentionArgs) Kind() string { return "message_retention" }

// MessageRetentionWorker deletes Discord messages older than
// messageRetentionDays. Runs daily as a periodic job.
type MessageRetentionWorker struct {
	river.WorkerDefaults[MessageRetentionArgs]
	Queries *db.Queries
}

func (w *MessageRetentionWorker) Work(ctx context.Context, _ *river.Job[MessageRetentionArgs]) error {
	cutoff := time.Now().UTC().AddDate(0, 0, -messageRetentionDays)
	if err := w.Queries.DeleteMessagesOlderThan(ctx, pgtype.Timestamptz{Time: cutoff, Valid: true}); err != nil {
		return fmt.Errorf("deleting messages older than %d days: %w", messageRetentionDays, err)
	}
	slog.Info("message retention cleanup ran", "cutoff", cutoff.Format(time.RFC3339))
	return nil
}
