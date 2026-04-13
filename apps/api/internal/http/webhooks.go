package http

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/webhook"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

func stripeWebhookHandler(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 65536))
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to read body")
			return
		}

		event, err := webhook.ConstructEvent(body, r.Header.Get("Stripe-Signature"), s.Config.StripeWebhookSecret)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid signature")
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
	_ = s.Queries.UpdateSubscriptionStatus(ctx, db.UpdateSubscriptionStatusParams{
		ID:                 user.ID,
		SubscriptionStatus: "active",
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
