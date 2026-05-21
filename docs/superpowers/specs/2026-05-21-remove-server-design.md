# Distill — Remove a Server (Quota-Preserving) — Design

**Date:** 2026-05-21
**Status:** Approved
**Repo:** distill (`/Users/sisle/code/work/distill`)

## Problem

There is no way to remove a server. Two coupled requirements:

1. A user must be able to **hard-delete** a server — its channels,
   monitored messages, and newsletter drafts gone permanently.
2. Removing a server and later re-adding the **same Discord guild**
   must NOT grant a fresh "1 free generation per server" credit.

The free-generation quota today is computed by `CountOnDemandEverForGuild`:
```sql
SELECT COUNT(*) FROM newsletters n
JOIN servers s ON s.id = n.server_id
WHERE s.discord_guild_id = $1 AND n.is_on_demand = true;
```
It counts `newsletters` rows. Newsletters cascade-delete with their
`servers` row (`ON DELETE CASCADE`). So a hard delete drops the count
to 0 → re-adding the guild resets the free generation. The quota and
the hard-delete requirement are in direct conflict unless free-gen
usage is recorded somewhere that survives the cascade.

So this feature is: a delete endpoint + UI, AND a durable per-guild
free-generation ledger.

## Section 1 — Durable free-gen ledger

A new table records that a Discord guild has consumed its free
on-demand generation — independent of `servers`/`newsletters`.

### Migration `007_guild_free_generations`

`apps/api/migrations/007_guild_free_generations.up.sql`:
```sql
CREATE TABLE guild_free_generations (
    discord_guild_id  TEXT PRIMARY KEY,
    used_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill from existing on-demand newsletters so current users are
-- not reset. Runs once, atomically with the table creation.
INSERT INTO guild_free_generations (discord_guild_id)
SELECT DISTINCT s.discord_guild_id
FROM newsletters n
JOIN servers s ON s.id = n.server_id
WHERE n.is_on_demand = true
ON CONFLICT (discord_guild_id) DO NOTHING;
```
`apps/api/migrations/007_guild_free_generations.down.sql`:
```sql
DROP TABLE guild_free_generations;
```

The table is keyed by `discord_guild_id`, has **no foreign key** to
`servers`, so it is untouched by any server delete.

### sqlc queries (`apps/api/queries/`)

Add to a queries file (a new `apps/api/queries/guild_free_generations.sql`):
```sql
-- name: MarkGuildFreeGenerationUsed :exec
INSERT INTO guild_free_generations (discord_guild_id)
VALUES ($1)
ON CONFLICT (discord_guild_id) DO NOTHING;

-- name: GuildFreeGenerationUsed :one
SELECT EXISTS (
  SELECT 1 FROM guild_free_generations WHERE discord_guild_id = $1
)::bool;
```
Regenerate sqlc-generated Go (`sqlc generate` from `apps/api/`).

### Write the ledger on on-demand generation

In `apps/api/internal/http/newsletters.go`, the `createNewsletter`
handler (`POST /api/servers/{serverID}/newsletters`) saves the
newsletter via `CreateNewsletter`. After a SUCCESSFUL `CreateNewsletter`
when `req.IsOnDemand` is true and the user is NOT an active subscriber
and NOT an admin, call `MarkGuildFreeGenerationUsed(server.DiscordGuildID)`.
Idempotent (`ON CONFLICT DO NOTHING`), so repeated calls are safe. A
failure to write the ledger row is logged but does NOT fail the request
(the newsletter is already saved; the next generation attempt's quota
check would still catch a missing row — but in practice the upsert
succeeds).

### Quota check uses the ledger, not the newsletter join

Two places currently call `CountOnDemandEverForGuild` for free-tier
users — `getGenerationQuota` and the free-tier gate in
`createNewsletter`. Change BOTH to use `GuildFreeGenerationUsed`:
- `getGenerationQuota` free-tier branch: `used := GuildFreeGenerationUsed(guildID) ? 1 : 0`, `remaining := 1 - used`, response `{used, limit:1, tier:"free", remaining}`.
- `createNewsletter` free-tier gate: if `GuildFreeGenerationUsed(server.DiscordGuildID)` is true, reject with 402 "free tier limit reached".

Once both call sites are migrated, `CountOnDemandEverForGuild` is dead
— remove the query from `newsletters.sql` and regenerate sqlc so the
generated method is dropped too.

## Section 2 — Delete endpoint

### Go — `DELETE /api/servers/{serverID}`

Add a `deleteServer` handler in `apps/api/internal/http/servers.go`:
- Read `serverID` from the path; `GetServerByID`; 404 if missing.
- Ownership: `server.UserID != userID` → 403 (same check the other
  server routes use).
- Hard-delete the server row via a new sqlc query
  `DeleteServer :exec` — `DELETE FROM servers WHERE id = $1`.
  `monitored_channels`, `messages`, `optouts`, `newsletters` all
  cascade-delete via their existing `ON DELETE CASCADE` FKs.
  `guild_free_generations` has no FK to `servers` and is untouched.
- Respond `{deleted: true}`.

Register in `apps/api/internal/http/router.go` inside the authenticated
group, next to `GET`/`PATCH /api/servers/{serverID}`:
`r.Delete("/api/servers/{serverID}", deleteServer(s))`.

### Web proxy — `DELETE /api/proxy/servers/[id]`

Add a `DELETE` export to
`apps/web/app/api/proxy/servers/[id]/route.ts` forwarding to
`/api/servers/<id>` via `goFetch` — the same shape as the existing
`GET`/`PATCH` handlers in that file.

## Section 3 — Remove-server UI

In the server overview page
`apps/web/app/(app)/dashboard/servers/[id]/page.tsx`, add a
**"Danger zone"** `SettingsCard` as the last section.

- A "Remove this server" row: short description + a destructive
  `Button` ("Remove server").
- Clicking opens a `Dialog` (the `ui/dialog` primitive) that requires
  the user to type the **server's exact name** into an `Input` before
  the destructive confirm button enables — naming a specific server
  prevents deleting the wrong one.
- The dialog body states plainly: this permanently deletes the server,
  its channels, and its newsletter drafts; and that if the free
  generation was already used it stays used — re-adding this Discord
  server will not reset it.
- On confirm: `fetch("/api/proxy/servers/<id>", { method: "DELETE" })`.
  On success → `router.push("/dashboard")`. On failure → show an inline
  error in the dialog (do not leave it stuck).

All existing Voice / Schedule / Channels / Newsletters sections and
their logic are unchanged — this only adds the new section + dialog
state.

## Section 4 — Re-add flow

No code change. Onboarding's `selectGuild` already does "find an
existing server for this `discord_guild_id`, else create one." After a
delete there is no server row, so re-adding creates a fresh server
(clean channels + newsletters). The quota check now reads
`guild_free_generations`, which still holds the guild's row, so the
free generation is not reset. The existing onboarding flow works
unchanged once Sections 1–2 land.

## Files

Go API:
- Create: `apps/api/migrations/007_guild_free_generations.up.sql`
- Create: `apps/api/migrations/007_guild_free_generations.down.sql`
- Create: `apps/api/queries/guild_free_generations.sql`
- Modify: `apps/api/queries/newsletters.sql` (remove `CountOnDemandEverForGuild`)
- Modify: `apps/api/queries/servers.sql` (add `DeleteServer`)
- Regenerate: `apps/api/internal/db/*.sql.go` (via `sqlc generate`)
- Modify: `apps/api/internal/http/newsletters.go` (ledger write + quota read)
- Modify: `apps/api/internal/http/servers.go` (add `deleteServer`)
- Modify: `apps/api/internal/http/router.go` (register the route)

Web:
- Modify: `apps/web/app/api/proxy/servers/[id]/route.ts` (add `DELETE`)
- Modify: `apps/web/app/(app)/dashboard/servers/[id]/page.tsx` (Danger-zone section)

## Testing

- Go: `go build ./...` from `apps/api/`. If the package has tests for
  the quota handler, update them; otherwise verification is the build +
  the live check below.
- Web: `pnpm build` from `apps/web/`.
- Live (post-deploy): generate a free newsletter on a server →
  `guild_free_generations` gets a row; remove the server; re-add the
  same Discord server via onboarding; its generation-quota shows
  `remaining: 0` (free generation NOT reset).

## Risks & Mitigations

- **Backfill timing:** migration 007 must create the table AND backfill
  from `newsletters` in the same migration, before any server is
  deleted — otherwise a user who deletes a server before the deploy
  loses their recorded free-gen usage. The single migration file does
  both atomically. (Existing servers are not deleted by this work, so
  there is no race in practice.)
- **Dead query removal:** `CountOnDemandEverForGuild` must be removed
  only after BOTH call sites switch to `GuildFreeGenerationUsed`, or
  the build breaks. The plan sequences this.
- **Ledger-write failure:** non-fatal (logged) — the newsletter is
  already saved; worst case the quota check is briefly lenient until
  the next successful generation upserts the row. Acceptable.
- **Out of scope:** no soft-delete / undo, no bulk delete, no
  per-guild quota beyond the existing 1-free rule.

## Success Criteria

- A user can remove a server from its overview page via a
  type-the-name confirm dialog; it redirects to the dashboard.
- The removed server's channels, messages, and newsletters are gone.
- Re-adding the same Discord server creates a fresh server but does
  NOT restore the free generation if it was already used.
- `apps/api` and `apps/web` build cleanly; `CountOnDemandEverForGuild`
  is fully removed.
