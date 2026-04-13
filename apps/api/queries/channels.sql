-- name: AddMonitoredChannel :one
INSERT INTO monitored_channels (server_id, discord_channel_id, name)
VALUES ($1, $2, $3)
ON CONFLICT (server_id, discord_channel_id) DO UPDATE SET name = EXCLUDED.name
RETURNING *;

-- name: ListMonitoredChannels :many
SELECT * FROM monitored_channels WHERE server_id = $1 ORDER BY name;

-- name: DeleteMonitoredChannel :exec
DELETE FROM monitored_channels WHERE server_id = $1 AND discord_channel_id = $2;

-- name: GetMonitoredChannel :one
SELECT * FROM monitored_channels WHERE server_id = $1 AND discord_channel_id = $2;

-- name: IsChannelMonitored :one
SELECT EXISTS(
    SELECT 1 FROM monitored_channels mc
    JOIN servers s ON mc.server_id = s.id
    WHERE s.discord_guild_id = $1 AND mc.discord_channel_id = $2
) AS is_monitored;

-- name: GetServerAndChannelByDiscordIDs :one
SELECT mc.id AS channel_id, s.id AS server_id FROM monitored_channels mc
JOIN servers s ON mc.server_id = s.id
WHERE s.discord_guild_id = $1 AND mc.discord_channel_id = $2 AND s.status = 'active';
