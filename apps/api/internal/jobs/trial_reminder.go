package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/riverqueue/river"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

// DiscordDMSender abstracts sending DMs via Discord.
type DiscordDMSender interface {
	SendDM(userID string, message string) error
}

// TrialReminderArgs are the arguments for the trial reminder job.
type TrialReminderArgs struct{}

func (TrialReminderArgs) Kind() string { return "trial_reminder" }

// TrialReminderWorker sends DMs to users whose trials are about to expire.
type TrialReminderWorker struct {
	river.WorkerDefaults[TrialReminderArgs]
	Queries  *db.Queries
	DMSender DiscordDMSender
}

func (w *TrialReminderWorker) Work(ctx context.Context, _ *river.Job[TrialReminderArgs]) error {
	users, err := w.Queries.GetTrialExpiringUsers(ctx)
	if err != nil {
		return fmt.Errorf("querying expiring users: %w", err)
	}

	if len(users) == 0 {
		slog.Info("no trial-expiring users found")
		return nil
	}

	for _, u := range users {
		daysLeft := int(math.Ceil(time.Until(u.TrialEndsAt.Time).Hours() / 24))
		msg := fmt.Sprintf(
			"Hey %s! Your Distill trial expires in %d day(s). "+
				"Upgrade to keep getting weekly community digests: %s",
			u.DiscordUsername, daysLeft, "https://distill.so/billing",
		)
		if err := w.DMSender.SendDM(u.DiscordID, msg); err != nil {
			slog.Warn("failed to send trial reminder DM", "user_id", u.DiscordID, "err", err)
			continue
		}
		slog.Info("sent trial reminder", "user_id", u.DiscordID, "days_left", daysLeft)
	}

	return nil
}
