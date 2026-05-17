-- name: CreateServer :one
INSERT INTO servers (user_id, discord_guild_id, name, icon_url, community_type)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, discord_guild_id) DO UPDATE SET
    name = EXCLUDED.name,
    icon_url = EXCLUDED.icon_url,
    status = 'active'
RETURNING *;

-- name: GetServerByID :one
SELECT * FROM servers WHERE id = $1;

-- name: GetServerByGuildID :one
SELECT * FROM servers WHERE discord_guild_id = $1 AND status = 'active';

-- name: ListServersByUserID :many
SELECT * FROM servers WHERE user_id = $1 AND status != 'removed' ORDER BY created_at DESC;

-- name: UpdateServer :one
-- The $6 voice_sample arg uses a small sentinel pattern: pass the
-- literal string "__SET_NULL__" to clear the voice sample; pass NULL
-- to keep the existing value. Plain COALESCE can't say "set to NULL
-- only when the caller meant to" — it conflates "field omitted" with
-- "explicit clear" — so we need a CASE.
UPDATE servers SET
    community_type = COALESCE($2, community_type),
    schedule_cron = COALESCE($3, schedule_cron),
    status = COALESCE($4, status),
    name = COALESCE($5, name),
    voice_sample = CASE
        WHEN sqlc.narg('voice_sample')::text IS NULL THEN voice_sample
        WHEN sqlc.narg('voice_sample')::text = '__SET_NULL__' THEN NULL
        ELSE sqlc.narg('voice_sample')::text
    END
WHERE id = $1
RETURNING *;

-- name: SetServerRemoved :exec
UPDATE servers SET status = 'removed' WHERE discord_guild_id = $1;

-- name: ListActiveServersForSchedule :many
SELECT s.* FROM servers s
JOIN users u ON s.user_id = u.id
WHERE s.status = 'active'
  AND u.subscription_status = 'active';
