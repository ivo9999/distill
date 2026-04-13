-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByDiscordID :one
SELECT * FROM users WHERE discord_id = $1;

-- name: UpsertUser :one
INSERT INTO users (discord_id, discord_username, email, avatar_url)
VALUES ($1, $2, $3, $4)
ON CONFLICT (discord_id) DO UPDATE SET
    discord_username = EXCLUDED.discord_username,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
RETURNING *;

-- name: UpdateStripeCustomerID :exec
UPDATE users SET stripe_customer_id = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdateSubscriptionStatus :exec
UPDATE users SET subscription_status = $2, updated_at = NOW() WHERE id = $1;

-- name: GetTrialExpiringUsers :many
SELECT * FROM users
WHERE subscription_status = 'trialing'
  AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '2 days';

-- name: GetUserByStripeCustomerID :one
SELECT * FROM users WHERE stripe_customer_id = $1;
