package http

import (
	"encoding/hex"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"

	"github.com/sislelabs/distill/apps/api/internal/auth"
	"github.com/sislelabs/distill/apps/api/internal/db"

	portalsession "github.com/stripe/stripe-go/v81/billingportal/session"
)

func createCheckout(s *Server) http.HandlerFunc {
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

		stripe.Key = s.Config.StripeSecretKey

		// Create or reuse Stripe customer.
		customerID := ""
		if user.StripeCustomerID.Valid && user.StripeCustomerID.String != "" {
			customerID = user.StripeCustomerID.String
		}

		params := &stripe.CheckoutSessionParams{
			Mode: stripe.String(string(stripe.CheckoutSessionModeSubscription)),
			LineItems: []*stripe.CheckoutSessionLineItemParams{
				{
					Price:    stripe.String(s.Config.StripePriceID),
					Quantity: stripe.Int64(1),
				},
			},
			SuccessURL: stripe.String(s.Config.AppBaseURL + "/billing?success=true"),
			CancelURL:  stripe.String(s.Config.AppBaseURL + "/billing?canceled=true"),
		}

		if customerID != "" {
			params.Customer = stripe.String(customerID)
		} else {
			params.CustomerEmail = stripe.String(user.Email)
		}

		params.SubscriptionData = &stripe.CheckoutSessionSubscriptionDataParams{}
		params.SubscriptionData.AddMetadata("user_id", formatUUID(userID))

		sess, err := session.New(params)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create checkout session")
			return
		}

		// If this is a new customer, save the customer ID after checkout is created.
		if customerID == "" && sess.Customer != nil {
			_ = s.Queries.UpdateStripeCustomerID(r.Context(), db.UpdateStripeCustomerIDParams{
				ID:               userID,
				StripeCustomerID: pgtype.Text{String: sess.Customer.ID, Valid: true},
			})
		}

		writeJSON(w, http.StatusOK, map[string]string{"url": sess.URL})
	}
}

func createPortal(s *Server) http.HandlerFunc {
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

		if !user.StripeCustomerID.Valid || user.StripeCustomerID.String == "" {
			writeError(w, http.StatusBadRequest, "no stripe customer found")
			return
		}

		stripe.Key = s.Config.StripeSecretKey

		params := &stripe.BillingPortalSessionParams{
			Customer:  stripe.String(user.StripeCustomerID.String),
			ReturnURL: stripe.String(s.Config.AppBaseURL + "/billing"),
		}

		sess, err := portalsession.New(params)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create portal session")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"url": sess.URL})
	}
}

func formatUUID(id pgtype.UUID) string {
	b := id.Bytes
	s := hex.EncodeToString(b[:])
	return s[:8] + "-" + s[8:12] + "-" + s[12:16] + "-" + s[16:20] + "-" + s[20:]
}
