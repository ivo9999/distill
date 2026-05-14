ALTER TABLE users ALTER COLUMN subscription_status SET DEFAULT 'trialing';
ALTER TABLE users ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '14 days');
