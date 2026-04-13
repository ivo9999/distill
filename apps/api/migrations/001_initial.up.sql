CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id          TEXT NOT NULL UNIQUE,
    discord_username    TEXT NOT NULL,
    email               TEXT NOT NULL,
    avatar_url          TEXT,
    stripe_customer_id  TEXT UNIQUE,
    subscription_status TEXT NOT NULL DEFAULT 'trialing',
    trial_ends_at       TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE servers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    discord_guild_id    TEXT NOT NULL,
    name                TEXT NOT NULL,
    icon_url            TEXT,
    community_type      TEXT,
    schedule_cron       TEXT NOT NULL DEFAULT '0 18 * * 0',
    status              TEXT NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, discord_guild_id)
);

CREATE TABLE monitored_channels (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    discord_channel_id  TEXT NOT NULL,
    name                TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (server_id, discord_channel_id)
);

CREATE TABLE messages (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_message_id      TEXT NOT NULL UNIQUE,
    server_id               UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    channel_id              UUID NOT NULL REFERENCES monitored_channels(id) ON DELETE CASCADE,
    discord_author_id       TEXT NOT NULL,
    author_display_name     TEXT NOT NULL,
    content                 TEXT NOT NULL,
    reply_to_discord_id     TEXT,
    thread_discord_id       TEXT,
    sent_at                 TIMESTAMPTZ NOT NULL,
    reaction_count          INTEGER NOT NULL DEFAULT 0,
    reply_count             INTEGER NOT NULL DEFAULT 0,
    raw_payload             JSONB NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_messages_server_sent ON messages(server_id, sent_at DESC);
CREATE INDEX idx_messages_channel_sent ON messages(channel_id, sent_at DESC);

CREATE TABLE optouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    discord_user_id     TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (server_id, discord_user_id)
);

CREATE TABLE newsletters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id           UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft',
    draft_markdown      TEXT NOT NULL,
    edited_markdown     TEXT,
    published_at        TIMESTAMPTZ,
    published_url       TEXT,
    cost_usd            NUMERIC(10, 4) NOT NULL DEFAULT 0,
    pass1_tokens_in     INTEGER NOT NULL DEFAULT 0,
    pass1_tokens_out    INTEGER NOT NULL DEFAULT 0,
    pass2_tokens_in     INTEGER NOT NULL DEFAULT 0,
    pass2_tokens_out    INTEGER NOT NULL DEFAULT 0,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_newsletters_server_created ON newsletters(server_id, created_at DESC);

CREATE TABLE publisher_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL,
    api_key_encrypted   TEXT NOT NULL,
    publication_id      TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, platform)
);
