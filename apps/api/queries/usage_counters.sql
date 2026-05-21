-- name: IncrementUsageCounter :one
-- Atomically bump today's counter for (user, kind) and return the new
-- count. The caller compares the returned count against a per-kind
-- limit; doing the increment-then-read in one statement closes the
-- check-then-act race.
INSERT INTO usage_counters (user_id, kind, day, count)
VALUES ($1, $2, CURRENT_DATE, 1)
ON CONFLICT (user_id, kind, day)
DO UPDATE SET count = usage_counters.count + 1
RETURNING count;
