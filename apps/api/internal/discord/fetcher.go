package discord

import (
	"context"
	"encoding/json"
	"time"

	"github.com/bwmarrin/discordgo"

	"github.com/sislelabs/distill/apps/api/internal/jobs"
)

// Fetcher uses discordgo to fetch channel message history via REST API.
type Fetcher struct {
	session *discordgo.Session
}

// NewFetcher creates a new Fetcher.
func NewFetcher(session *discordgo.Session) *Fetcher {
	return &Fetcher{session: session}
}

// FetchChannelHistory fetches up to `limit` messages from a channel, paginating as needed.
func (f *Fetcher) FetchChannelHistory(ctx context.Context, channelID string, limit int) ([]jobs.DiscordMessage, error) {
	var allMessages []jobs.DiscordMessage
	beforeID := ""
	pageSize := 100
	if limit < pageSize {
		pageSize = limit
	}

	for len(allMessages) < limit {
		remaining := limit - len(allMessages)
		if remaining < pageSize {
			pageSize = remaining
		}

		msgs, err := f.session.ChannelMessages(channelID, pageSize, beforeID, "", "")
		if err != nil {
			return allMessages, err
		}
		if len(msgs) == 0 {
			break
		}

		for _, m := range msgs {
			if m.Author == nil || m.Author.Bot {
				continue
			}

			ts := m.Timestamp
			if ts.IsZero() {
				ts = time.Now()
			}

			replyToID := ""
			if m.MessageReference != nil {
				replyToID = m.MessageReference.MessageID
			}

			threadID := ""
			if m.Thread != nil {
				threadID = m.Thread.ID
			}

			reactionCount := 0
			for _, r := range m.Reactions {
				reactionCount += r.Count
			}

			displayName := m.Author.Username
			if m.Member != nil && m.Member.Nick != "" {
				displayName = m.Member.Nick
			}

			raw, _ := json.Marshal(m)

			allMessages = append(allMessages, jobs.DiscordMessage{
				ID:                m.ID,
				AuthorID:          m.Author.ID,
				AuthorDisplayName: displayName,
				Content:           m.Content,
				Timestamp:         ts.Format(time.RFC3339),
				ReactionCount:     reactionCount,
				ReplyCount:        0,
				ReplyToID:         replyToID,
				ThreadID:          threadID,
				RawPayload:        raw,
			})
		}

		beforeID = msgs[len(msgs)-1].ID

		// Rate limit: brief pause between pages.
		select {
		case <-ctx.Done():
			return allMessages, ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
	}

	return allMessages, nil
}
