-- Tracks Stripe webhook event IDs that have already been processed, so
-- a retried or out-of-order delivery (Stripe guarantees at-least-once)
-- is not applied twice.
CREATE TABLE processed_stripe_events (
    event_id     TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
