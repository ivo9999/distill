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

-- name: UpdateMonitoredChannelWeight :one
-- Bumps a channel's Pass1 weight (0.5 / 1.0 / 2.0 nominally; any
-- NUMERIC(3,2) is accepted at the DB level). Returns the row so the
-- handler can echo the new value back without a follow-up SELECT.
--
-- Scoped by server_id + discord_channel_id (rather than the row UUID)
-- to match the route shape used by DeleteMonitoredChannel — keeps the
-- URL identifier story consistent.
UPDATE monitored_channels
SET weight = $3
WHERE server_id = $1 AND discord_channel_id = $2
RETURNING *;
