package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

// SchedulerArgs are the arguments for the scheduler job (periodic).
type SchedulerArgs struct{}

func (SchedulerArgs) Kind() string { return "scheduler" }

// SchedulerWorker checks active servers and enqueues generate jobs when their cron matches.
type SchedulerWorker struct {
	river.WorkerDefaults[SchedulerArgs]
	Queries  *db.Queries
	Inserter *river.Client[pgx.Tx]
}

func (w *SchedulerWorker) Work(ctx context.Context, _ *river.Job[SchedulerArgs]) error {
	servers, err := w.Queries.ListActiveServersForSchedule(ctx)
	if err != nil {
		return fmt.Errorf("listing active servers: %w", err)
	}

	now := time.Now().UTC()

	for _, s := range servers {
		if !cronMatchesHour(s.ScheduleCron, now) {
			continue
		}

		_, err := w.Inserter.Insert(ctx, GenerateNewsletterArgs{
			ServerID: s.ID,
		}, nil)
		if err != nil {
			slog.Error("failed to enqueue generate job", "server_id", s.ID, "err", err)
			continue
		}
		slog.Info("enqueued generate job", "server_id", s.ID, "cron", s.ScheduleCron)
	}

	return nil
}

// cronMatchesHour does a simplified cron check: it parses "0 H * * DOW"
// and checks if the current hour and day-of-week match.
func cronMatchesHour(cron string, now time.Time) bool {
	var minute, hour int
	var dow string
	_, err := fmt.Sscanf(cron, "%d %d * * %s", &minute, &hour, &dow)
	if err != nil {
		slog.Warn("failed to parse cron expression", "cron", cron, "err", err)
		return false
	}

	if now.Hour() != hour {
		return false
	}

	if dow == "*" {
		return true
	}

	// Map day-of-week: 0=Sunday ... 6=Saturday
	currentDow := int(now.Weekday())
	// Parse comma-separated days
	for i := 0; i < len(dow); i++ {
		if dow[i] >= '0' && dow[i] <= '6' {
			if int(dow[i]-'0') == currentDow {
				return true
			}
		}
	}

	return false
}
