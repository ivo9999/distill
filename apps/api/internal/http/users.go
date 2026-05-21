package http

import (
	"log/slog"
	"net/http"

	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/subscription"

	"github.com/sislelabs/distill/apps/api/internal/auth"
)

func getMe(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		user, err := s.Queries.GetUserByID(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"id":                  user.ID,
			"discord_id":          user.DiscordID,
			"discord_username":    user.DiscordUsername,
			"email":               user.Email,
			"avatar_url":          user.AvatarUrl,
			"subscription_status": user.SubscriptionStatus,
		})
	}
}

// deleteMe permanently deletes the authenticated user's account. The DB row
// delete cascades to servers, channels, messages, optouts, newsletters and
// publisher connections via ON DELETE CASCADE. Any active Stripe subscription
// is cancelled first; a Stripe failure is logged but does NOT block deletion —
// the user asked to leave, and an orphaned Stripe customer with no live
// subscription is harmless (and stops being billed once cancelled).
func deleteMe(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := auth.UserIDFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		user, err := s.Queries.GetUserByID(r.Context(), userID)
		if err != nil {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}

		// Best-effort: cancel every non-terminal subscription for this
		// customer before we drop the row.
		if user.StripeCustomerID.Valid && user.StripeCustomerID.String != "" {
			cancelStripeSubscriptions(user.StripeCustomerID.String)
		}

		if err := s.Queries.DeleteUser(r.Context(), userID); err != nil {
			slog.Error("failed to delete user", "user_id", user.ID, "err", err)
			writeError(w, http.StatusInternalServerError, "failed to delete account")
			return
		}

		slog.Info("account deleted", "user_id", user.ID)
		writeJSON(w, http.StatusOK, map[string]bool{"deleted": true})
	}
}

// cancelStripeSubscriptions cancels all active/trialing/past_due subscriptions
// for a customer. Errors are logged, never returned — deletion proceeds either
// way (see deleteMe).
func cancelStripeSubscriptions(customerID string) {
	it := subscription.List(&stripe.SubscriptionListParams{
		Customer: stripe.String(customerID),
		Status:   stripe.String("all"),
	})
	for it.Next() {
		sub := it.Subscription()
		switch sub.Status {
		case stripe.SubscriptionStatusCanceled, stripe.SubscriptionStatusIncompleteExpired:
			continue
		}
		if _, err := subscription.Cancel(sub.ID, nil); err != nil {
			slog.Error("failed to cancel stripe subscription",
				"customer_id", customerID, "subscription_id", sub.ID, "err", err)
		}
	}
	if err := it.Err(); err != nil {
		slog.Error("failed to list stripe subscriptions", "customer_id", customerID, "err", err)
	}
}
