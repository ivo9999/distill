-- name: IsStripeEventProcessed :one
-- Reports whether a Stripe event has already been fully processed.
-- Checked before running a webhook handler so a retried delivery is
-- skipped.
SELECT EXISTS (
  SELECT 1 FROM processed_stripe_events WHERE event_id = $1
)::bool;

-- name: ClaimStripeEvent :one
-- Records that a Stripe event has been processed. Called *after* the
-- handler succeeds. Returns the event_id on a fresh insert; returns no
-- row (ErrNoRows) when the event was already recorded — harmless, the
-- caller treats that as "already done."
INSERT INTO processed_stripe_events (event_id)
VALUES ($1)
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;
