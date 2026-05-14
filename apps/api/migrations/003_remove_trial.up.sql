ALTER TABLE users ALTER COLUMN subscription_status SET DEFAULT 'inactive';
ALTER TABLE users ALTER COLUMN trial_ends_at SET DEFAULT NOW();
