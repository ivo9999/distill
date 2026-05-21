-- Per-user, per-day counters for rate-limiting expensive operations
-- (LLM section-rewrites and subject-line generations). One row per
-- (user, kind, day); count is incremented atomically.
CREATE TABLE usage_counters (
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind     TEXT NOT NULL,
    day      DATE NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, kind, day)
);
