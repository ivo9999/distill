-- Per-channel weighting for Pass1 story-ranking.
--
-- Newsletter operators usually have one or two channels that are real
-- signal (#wins, #showcase, #help-with-resolved) and a long tail of
-- noise (#general, #off-topic). Without a way to bias the ranking,
-- a chatty #general drowns out a quiet #showcase. The weight column
-- multiplies each message's engagement_signal during Pass1 ranking:
--
--   2.0  → high-signal channel; stories from here float to the top.
--   1.0  → normal (the default; matches today's behavior).
--   0.5  → low-signal channel; stories from here only land if
--          they're individually strong.
--
-- Default 1.0 so existing rows are unchanged. NUMERIC(3,2) is overkill
-- precision-wise but gives us room for tweaks like 1.5 / 0.75 later
-- without a follow-up migration.
ALTER TABLE monitored_channels
    ADD COLUMN weight NUMERIC(3, 2) NOT NULL DEFAULT 1.00;
