-- name: AddOptout :exec
INSERT INTO optouts (server_id, discord_user_id)
VALUES ($1, $2)
ON CONFLICT (server_id, discord_user_id) DO NOTHING;

-- name: IsUserOptedOut :one
SELECT EXISTS(
    SELECT 1 FROM optouts WHERE server_id = $1 AND discord_user_id = $2
) AS is_opted_out;

-- name: ListOptouts :many
SELECT discord_user_id FROM optouts WHERE server_id = $1;
