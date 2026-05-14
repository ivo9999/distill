-- name: CreateNewsletter :one
INSERT INTO newsletters (
    server_id, period_start, period_end, status, draft_markdown,
    cost_usd, pass1_tokens_in, pass1_tokens_out, pass2_tokens_in, pass2_tokens_out,
    error_message, is_on_demand
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: GetNewsletterByID :one
SELECT * FROM newsletters WHERE id = $1;

-- name: ListNewslettersByServerID :many
SELECT * FROM newsletters WHERE server_id = $1 ORDER BY created_at DESC;

-- name: UpdateNewsletterMarkdown :one
UPDATE newsletters SET edited_markdown = $2, updated_at = NOW() WHERE id = $1 RETURNING *;

-- name: UpdateNewsletterPublished :exec
UPDATE newsletters SET
    status = 'published',
    published_url = $2,
    published_at = NOW(),
    updated_at = NOW()
WHERE id = $1;

-- name: UpdateNewsletterStatus :exec
UPDATE newsletters SET status = $2, error_message = $3, updated_at = NOW() WHERE id = $1;

-- name: GetLatestNewsletterByServerID :one
SELECT * FROM newsletters WHERE server_id = $1 ORDER BY created_at DESC LIMIT 1;

-- name: CountOnDemandThisMonth :one
SELECT COUNT(*)::int FROM newsletters
WHERE server_id = $1
  AND is_on_demand = true
  AND created_at >= date_trunc('month', NOW());

-- name: CountOnDemandEverForGuild :one
SELECT COUNT(*)::int FROM newsletters n
JOIN servers s ON s.id = n.server_id
WHERE s.discord_guild_id = $1
  AND n.is_on_demand = true;
