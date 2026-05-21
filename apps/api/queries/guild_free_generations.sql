-- name: MarkGuildFreeGenerationUsed :exec
INSERT INTO guild_free_generations (discord_guild_id)
VALUES ($1)
ON CONFLICT (discord_guild_id) DO NOTHING;

-- name: GuildFreeGenerationUsed :one
SELECT EXISTS (
  SELECT 1 FROM guild_free_generations WHERE discord_guild_id = $1
)::bool;
