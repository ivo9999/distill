package llmclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is a thin HTTP wrapper that calls the Next.js LLM endpoint.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// New creates a new LLM client.
func New(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// GenerateRequest is the payload sent to /api/internal/generate.
type GenerateRequest struct {
	CommunityType string    `json:"community_type"`
	ServerName    string    `json:"server_name"`
	// Optional past-newsletter exemplar used by Pass2 as a voice
	// anchor; the route ignores it when empty.
	VoiceSample string    `json:"voice_sample,omitempty"`
	Messages    []Message `json:"messages"`
}

// Message matches the TypeScript Message type.
type Message struct {
	ID            string  `json:"id"`
	AuthorID      string  `json:"authorId"`
	AuthorName    string  `json:"authorName"`
	Content       string  `json:"content"`
	Timestamp     string  `json:"timestamp"`
	ReactionCount int     `json:"reactionCount"`
	ReplyCount    int     `json:"replyCount"`
	ReplyToID     string  `json:"replyToId,omitempty"`
	ThreadID      string  `json:"threadId,omitempty"`
	ChannelName   string  `json:"channelName,omitempty"`
	// Per-channel weight (0.5 / 1.0 / 2.0 nominally). Optional so the
	// experiment script and any legacy caller can omit it; the pipeline
	// defaults missing values to 1.0.
	ChannelWeight float64 `json:"channelWeight,omitempty"`
	// Discord channel ID — needed so the editor can build per-message
	// permalinks of the form discord.com/channels/<guild>/<channel>/<id>.
	// Empty on the experiment script path; the pipeline degrades
	// gracefully (no permalink shown for that message).
	DiscordChannelID string `json:"discordChannelId,omitempty"`
}

// GenerateResponse is the response from /api/internal/generate.
type GenerateResponse struct {
	Markdown       string  `json:"markdown"`
	CostUsd        float64 `json:"costUsd"`
	Pass1TokensIn  int     `json:"pass1TokensIn"`
	Pass1TokensOut int     `json:"pass1TokensOut"`
	Pass2TokensIn  int     `json:"pass2TokensIn"`
	Pass2TokensOut int     `json:"pass2TokensOut"`
	// Per-section source map (see pipeline.ts SourceSection). Carried
	// through as raw JSON since the Go side never reads the shape —
	// it just stores it in the newsletters.sources JSONB column.
	Sources json.RawMessage `json:"sources,omitempty"`
}

// Generate calls the Next.js LLM pipeline endpoint.
func (c *Client) Generate(ctx context.Context, req GenerateRequest) (*GenerateResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/internal/generate", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("calling generate endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("generate endpoint returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result GenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}
	return &result, nil
}

// PublishRequest is the payload sent to /api/internal/publish.
type PublishRequest struct {
	Markdown      string `json:"markdown"`
	Subject       string `json:"subject"`
	Platform      string `json:"platform"`
	APIKey        string `json:"api_key"`
	PublicationID string `json:"publication_id,omitempty"`
}

// PublishResponse is the response from /api/internal/publish.
type PublishResponse struct {
	PublishedURL string `json:"published_url"`
}

// Publish calls the Next.js publishing endpoint.
func (c *Client) Publish(ctx context.Context, req PublishRequest) (*PublishResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshaling request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/internal/publish", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("calling publish endpoint: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("publish endpoint returned %d: %s", resp.StatusCode, string(respBody))
	}

	var result PublishResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}
	return &result, nil
}
