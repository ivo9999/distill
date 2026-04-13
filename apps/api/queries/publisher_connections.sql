-- name: UpsertPublisherConnection :one
INSERT INTO publisher_connections (user_id, platform, api_key_encrypted, publication_id, metadata)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (user_id, platform) DO UPDATE SET
    api_key_encrypted = EXCLUDED.api_key_encrypted,
    publication_id = EXCLUDED.publication_id,
    metadata = EXCLUDED.metadata
RETURNING *;

-- name: GetPublisherConnection :one
SELECT * FROM publisher_connections WHERE user_id = $1 AND platform = $2;

-- name: ListPublisherConnections :many
SELECT * FROM publisher_connections WHERE user_id = $1 ORDER BY platform;

-- name: DeletePublisherConnection :exec
DELETE FROM publisher_connections WHERE user_id = $1 AND platform = $2;
