-- Per-server voice exemplar.
--
-- One past newsletter the user pastes during onboarding (or any time
-- later in settings) that Pass2 uses as a style anchor. This is the
-- single biggest perceived-quality jump for a first-time user — the
-- difference between "AI-style writeup" and "this sounds like me."
--
-- TEXT is unbounded but the UI clamps to ~5000 chars; Pass2 only
-- needs a paragraph or two of voice signal, anything longer just
-- inflates token cost without measurable improvement.
--
-- Nullable because most existing rows won't have one and the prompt
-- gracefully omits the voice-anchor block when the sample is empty.
ALTER TABLE servers
    ADD COLUMN voice_sample TEXT;
