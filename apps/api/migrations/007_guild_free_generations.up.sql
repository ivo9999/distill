-- Durable record of which Discord guilds have consumed their free
-- on-demand generation. Keyed by discord_guild_id, with NO foreign key
-- to servers — so it survives a server hard-delete. Without this, the
-- free-gen quota (counted from cascade-deletable newsletter rows) would
-- reset whenever a server is removed and re-added.
CREATE TABLE guild_free_generations (
    discord_guild_id  TEXT PRIMARY KEY,
    used_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill from existing on-demand newsletters so current users keep
-- their consumed free generation.
INSERT INTO guild_free_generations (discord_guild_id)
SELECT DISTINCT s.discord_guild_id
FROM newsletters n
JOIN servers s ON s.id = n.server_id
WHERE n.is_on_demand = true
ON CONFLICT (discord_guild_id) DO NOTHING;
