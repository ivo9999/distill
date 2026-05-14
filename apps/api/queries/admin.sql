-- name: AdminGetUserStats :one
SELECT
    COUNT(*)::int AS total_users,
    COUNT(*) FILTER (WHERE subscription_status = 'active')::int AS active_users,
    COUNT(*) FILTER (WHERE subscription_status = 'trialing')::int AS trialing_users,
    COUNT(*) FILTER (WHERE subscription_status = 'inactive')::int AS inactive_users,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_users_7d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_users_30d
FROM users;

-- name: AdminGetNewsletterStats :one
SELECT
    COUNT(*)::int AS total_newsletters,
    COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_count,
    COUNT(*) FILTER (WHERE status = 'published')::int AS published_count,
    COUNT(*) FILTER (WHERE status = 'error')::int AS error_count,
    COUNT(*) FILTER (WHERE is_on_demand = true)::int AS on_demand_count,
    COUNT(*) FILTER (WHERE is_on_demand = false)::int AS scheduled_count,
    COALESCE(SUM(cost_usd), 0)::numeric(10,4) AS total_cost_usd,
    COALESCE(SUM(pass1_tokens_in + pass1_tokens_out + pass2_tokens_in + pass2_tokens_out), 0)::bigint AS total_tokens,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS newsletters_7d,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS newsletters_30d
FROM newsletters;

-- name: AdminGetServerStats :one
SELECT
    COUNT(*)::int AS total_servers,
    COUNT(*) FILTER (WHERE status = 'active')::int AS active_servers,
    COUNT(*) FILTER (WHERE status = 'removed')::int AS removed_servers
FROM servers;

-- name: AdminGetMessageStats :one
SELECT
    COUNT(*)::int AS total_messages,
    COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days')::int AS messages_7d,
    COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '30 days')::int AS messages_30d
FROM messages;

-- name: AdminListRecentUsers :many
SELECT
    u.id, u.discord_username, u.email, u.subscription_status,
    u.trial_ends_at, u.created_at,
    COUNT(DISTINCT s.id)::int AS server_count,
    COUNT(DISTINCT n.id)::int AS newsletter_count
FROM users u
LEFT JOIN servers s ON s.user_id = u.id AND s.status = 'active'
LEFT JOIN newsletters n ON n.server_id = s.id
GROUP BY u.id
ORDER BY u.created_at DESC
LIMIT 50;

-- name: AdminListRecentNewsletters :many
SELECT
    n.id, n.status, n.cost_usd, n.is_on_demand, n.created_at,
    n.pass1_tokens_in, n.pass1_tokens_out, n.pass2_tokens_in, n.pass2_tokens_out,
    s.name AS server_name,
    u.discord_username
FROM newsletters n
JOIN servers s ON s.id = n.server_id
JOIN users u ON u.id = s.user_id
ORDER BY n.created_at DESC
LIMIT 50;

-- name: AdminGetCostByDay :many
SELECT
    date_trunc('day', created_at)::date AS day,
    COUNT(*)::int AS newsletter_count,
    COALESCE(SUM(cost_usd), 0)::numeric(10,4) AS cost_usd
FROM newsletters
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY date_trunc('day', created_at)
ORDER BY day DESC;
