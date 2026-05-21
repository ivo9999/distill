-- name: InsertMessage :exec
INSERT INTO messages (
    discord_message_id, server_id, channel_id, discord_author_id,
    author_display_name, content, reply_to_discord_id, thread_discord_id,
    sent_at, reaction_count, reply_count, raw_payload
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (discord_message_id) DO NOTHING;

-- name: UpdateMessageContent :exec
UPDATE messages SET content = $2 WHERE discord_message_id = $1;

-- name: SoftDeleteMessage :exec
UPDATE messages SET content = '[deleted]' WHERE discord_message_id = $1;

-- name: IncrementReactionCount :exec
UPDATE messages SET reaction_count = reaction_count + 1 WHERE discord_message_id = $1;

-- name: GetMessagesForGeneration :many
SELECT m.* FROM messages m
LEFT JOIN optouts o ON o.server_id = m.server_id AND o.discord_user_id = m.discord_author_id
WHERE m.server_id = $1
  AND m.sent_at >= $2
  AND m.sent_at <= $3
  AND o.id IS NULL
  AND m.content != '[deleted]'
ORDER BY m.sent_at ASC;

-- name: DeleteMessagesByAuthorInServer :exec
DELETE FROM messages WHERE server_id = $1 AND discord_author_id = $2;

-- name: DeleteMessagesOlderThan :exec
DELETE FROM messages WHERE created_at < $1;
