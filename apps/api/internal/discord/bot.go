package discord

import (
	"fmt"
	"log/slog"

	"github.com/bwmarrin/discordgo"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

// Bot wraps a discordgo session and handles Discord events.
type Bot struct {
	session  *discordgo.Session
	pool     *pgxpool.Pool
	queries  *db.Queries
	appURL   string
	clientID string
}

// New creates a new Discord bot.
func New(token string, pool *pgxpool.Pool, queries *db.Queries, appURL, clientID string) (*Bot, error) {
	s, err := discordgo.New("Bot " + token)
	if err != nil {
		return nil, fmt.Errorf("creating discord session: %w", err)
	}

	s.Identify.Intents = discordgo.IntentsGuilds |
		discordgo.IntentsGuildMessages |
		discordgo.IntentsGuildMessageReactions |
		discordgo.IntentMessageContent |
		discordgo.IntentDirectMessages

	b := &Bot{
		session:  s,
		pool:     pool,
		queries:  queries,
		appURL:   appURL,
		clientID: clientID,
	}

	// Register event handlers.
	s.AddHandler(b.onMessageCreate)
	s.AddHandler(b.onMessageUpdate)
	s.AddHandler(b.onMessageDelete)
	s.AddHandler(b.onMessageReactionAdd)
	s.AddHandler(b.onGuildDelete)
	s.AddHandler(b.onInteractionCreate)

	return b, nil
}

// Start opens the websocket connection and registers slash commands.
func (b *Bot) Start() error {
	if err := b.session.Open(); err != nil {
		return fmt.Errorf("opening discord connection: %w", err)
	}

	if err := b.registerCommands(); err != nil {
		slog.Error("failed to register slash commands", "err", err)
	}

	slog.Info("discord bot started")
	return nil
}

// Stop gracefully shuts down the bot.
func (b *Bot) Stop() error {
	slog.Info("stopping discord bot")
	return b.session.Close()
}

// SendDM sends a direct message to a Discord user.
func (b *Bot) SendDM(userID string, message string) error {
	ch, err := b.session.UserChannelCreate(userID)
	if err != nil {
		return fmt.Errorf("creating DM channel: %w", err)
	}
	_, err = b.session.ChannelMessageSend(ch.ID, message)
	if err != nil {
		return fmt.Errorf("sending DM: %w", err)
	}
	return nil
}

// Session returns the underlying discordgo session for use by the fetcher.
func (b *Bot) Session() *discordgo.Session {
	return b.session
}
