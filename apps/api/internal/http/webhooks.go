package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/webhook"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

func stripeWebhookHandler(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 524288))
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to read body")
			return
		}

		event, err := webhook.ConstructEvent(body, r.Header.Get("Stripe-Signature"), s.Config.StripeWebhookSecret)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid signature")
			return
		}

		ctx := r.Context()

		// Idempotency pre-check: if this event was already fully
		// processed, skip it. The authoritative claim happens *after*
		// the handler runs (below) — claiming before would mean a
		// handler that dies mid-way leaves the event marked done but
		// its side effect unapplied, and Stripe's retry would then be
		// suppressed. The handlers only *set* subscription_status to a
		// deterministic value, so processing an event twice (if Stripe
		// retries before the post-claim commits) is harmless.
		if processed, perr := s.Queries.IsStripeEventProcessed(ctx, event.ID); perr != nil {
			slog.Error("failed to check stripe event", "event_id", event.ID, "err", perr)
			writeError(w, http.StatusInternalServerError, "failed to check event")
			return
		} else if processed {
			slog.Debug("stripe event already processed, skipping", "event_id", event.ID)
			w.WriteHeader(http.StatusOK)
			return
		}

		switch event.Type {
		case "checkout.session.completed":
			handleCheckoutCompleted(s, event)
		case "customer.subscription.created":
			handleSubscriptionUpdated(s, event)
		case "customer.subscription.updated":
			handleSubscriptionUpdated(s, event)
		case "customer.subscription.deleted":
			handleSubscriptionDeleted(s, event)
		case "invoice.payment_failed":
			handleInvoicePaymentFailed(s, event)
		default:
			slog.Debug("unhandled stripe event", "type", event.Type)
		}

		// Mark the event processed only after the handler ran. A
		// failure to record is non-fatal — worst case the event is
		// processed again on a Stripe retry, which is idempotent.
		if _, claimErr := s.Queries.ClaimStripeEvent(ctx, event.ID); claimErr != nil && !errors.Is(claimErr, pgx.ErrNoRows) {
			slog.Error("failed to mark stripe event processed", "event_id", event.ID, "err", claimErr)
		}

		w.WriteHeader(http.StatusOK)
	}
}

func handleCheckoutCompleted(s *Server, event stripe.Event) {
	var sess stripe.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
		slog.Error("failed to unmarshal checkout session", "err", err)
		return
	}

	if sess.Customer == nil {
		return
	}

	ctx := context.Background()

	// Find user by customer ID first.
	customerID := pgtype.Text{String: sess.Customer.ID, Valid: true}
	user, err := s.Queries.GetUserByStripeCustomerID(ctx, customerID)
	if err != nil {
		// Fall back to client_reference_id (user UUID) if customer lookup fails.
		if sess.ClientReferenceID != "" {
			var userID pgtype.UUID
			if scanErr := userID.Scan(sess.ClientReferenceID); scanErr == nil {
				user, err = s.Queries.GetUserByID(ctx, userID)
			}
		}
		if err != nil {
			slog.Error("checkout completed but user not found", "customer_id", sess.Customer.ID)
			return
		}
	}

	// Update stripe customer ID if not set.
	if !user.StripeCustomerID.Valid || user.StripeCustomerID.String == "" {
		_ = s.Queries.UpdateStripeCustomerID(ctx, db.UpdateStripeCustomerIDParams{
			ID:               user.ID,
			StripeCustomerID: customerID,
		})
	}

	// Update subscription status.
	// Prefer the actual subscription status — a checkout can complete
	// in an "incomplete" state (e.g. SCA still pending). Fall back to
	// "active" only when the session carries no subscription object.
	status := "active"
	if sess.Subscription != nil && sess.Subscription.Status != "" {
		status = string(sess.Subscription.Status)
	}
	_ = s.Queries.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:                 user.ID,
		SubscriptionStatus: status,
	})

	slog.Info("checkout completed", "user_id", user.ID, "customer_id", sess.Customer.ID)
}

func handleSubscriptionUpdated(s *Server, event stripe.Event) {
	var sub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		slog.Error("failed to unmarshal subscription", "err", err)
		return
	}

	if sub.Customer == nil {
		return
	}

	ctx := context.Background()
	customerID := pgtype.Text{String: sub.Customer.ID, Valid: true}
	user, err := s.Queries.GetUserByStripeCustomerID(ctx, customerID)
	if err != nil {
		slog.Warn("subscription updated but user not found", "customer_id", sub.Customer.ID)
		return
	}

	status := string(sub.Status)
	_ = s.Queries.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:                 user.ID,
		SubscriptionStatus: status,
	})

	slog.Info("subscription updated", "user_id", user.ID, "status", status)
}

func handleSubscriptionDeleted(s *Server, event stripe.Event) {
	var sub stripe.Subscription
	if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
		slog.Error("failed to unmarshal subscription", "err", err)
		return
	}

	if sub.Customer == nil {
		return
	}

	ctx := context.Background()
	customerID := pgtype.Text{String: sub.Customer.ID, Valid: true}
	user, err := s.Queries.GetUserByStripeCustomerID(ctx, customerID)
	if err != nil {
		slog.Warn("subscription deleted but user not found", "customer_id", sub.Customer.ID)
		return
	}

	_ = s.Queries.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:                 user.ID,
		SubscriptionStatus: "canceled",
	})

	slog.Info("subscription canceled", "user_id", user.ID)
}

func handleInvoicePaymentFailed(s *Server, event stripe.Event) {
	var inv stripe.Invoice
	if err := json.Unmarshal(event.Data.Raw, &inv); err != nil {
		slog.Error("failed to unmarshal invoice", "err", err)
		return
	}

	if inv.Customer == nil {
		return
	}

	ctx := context.Background()
	customerID := pgtype.Text{String: inv.Customer.ID, Valid: true}
	user, err := s.Queries.GetUserByStripeCustomerID(ctx, customerID)
	if err != nil {
		slog.Warn("invoice payment failed but user not found", "customer_id", inv.Customer.ID)
		return
	}

	_ = s.Queries.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:                 user.ID,
		SubscriptionStatus: "past_due",
	})

	slog.Info("invoice payment failed, set past_due", "user_id", user.ID)
}
