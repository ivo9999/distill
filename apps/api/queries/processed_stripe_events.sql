-- name: ClaimStripeEvent :one
-- Atomically record that a Stripe event is being processed. Returns the
-- event_id on a fresh insert; returns no row if the event was already
-- processed (the caller treats "no row" as "skip, already handled").
INSERT INTO processed_stripe_events (event_id)
VALUES ($1)
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;
