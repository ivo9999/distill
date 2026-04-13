package discord

import (
	"fmt"
	"log/slog"

	"github.com/bwmarrin/discordgo"

	"github.com/sislelabs/distill/apps/api/internal/db"
)

var slashCommands = []*discordgo.ApplicationCommand{
	{
		Name:        "distill",
		Description: "Distill bot commands",
		Options: []*discordgo.ApplicationCommandOption{
			{
				Name:        "setup",
				Description: "Get the setup link for Distill",
				Type:        discordgo.ApplicationCommandOptionSubCommand,
			},
			{
				Name:        "optout",
				Description: "Opt out of having your messages included in digests",
				Type:        discordgo.ApplicationCommandOptionSubCommand,
			},
			{
				Name:        "status",
				Description: "Show Distill status for this server",
				Type:        discordgo.ApplicationCommandOptionSubCommand,
			},
		},
	},
}

func (b *Bot) registerCommands() error {
	for _, cmd := range slashCommands {
		_, err := b.session.ApplicationCommandCreate(b.clientID, "", cmd)
		if err != nil {
			return fmt.Errorf("registering command %s: %w", cmd.Name, err)
		}
	}
	slog.Info("slash commands registered")
	return nil
}

func (b *Bot) onInteractionCreate(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if i.Type != discordgo.InteractionApplicationCommand {
		return
	}

	data := i.ApplicationCommandData()
	if data.Name != "distill" || len(data.Options) == 0 {
		return
	}

	sub := data.Options[0].Name
	switch sub {
	case "setup":
		b.handleSetup(s, i)
	case "optout":
		b.handleOptout(s, i)
	case "status":
		b.handleStatus(s, i)
	}
}

func (b *Bot) handleSetup(s *discordgo.Session, i *discordgo.InteractionCreate) {
	url := fmt.Sprintf("%s/servers?guild_id=%s", b.appURL, i.GuildID)
	respond(s, i, fmt.Sprintf("Set up Distill for this server: %s", url))
}

func (b *Bot) handleOptout(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if i.GuildID == "" {
		respond(s, i, "This command can only be used in a server.")
		return
	}

	ctx, cancel := contextFromInteraction()
	defer cancel()

	server, err := b.queries.GetServerByGuildID(ctx, i.GuildID)
	if err != nil {
		respond(s, i, "Distill is not set up for this server yet. Use `/distill setup` first.")
		return
	}

	userID := i.Member.User.ID
	err = b.queries.AddOptout(ctx, db.AddOptoutParams{
		ServerID:      server.ID,
		DiscordUserID: userID,
	})
	if err != nil {
		slog.Error("failed to add optout", "err", err)
		respond(s, i, "Something went wrong. Please try again.")
		return
	}

	respond(s, i, "You've been opted out. Your messages will no longer be included in Distill digests for this server.")
}

func (b *Bot) handleStatus(s *discordgo.Session, i *discordgo.InteractionCreate) {
	if i.GuildID == "" {
		respond(s, i, "This command can only be used in a server.")
		return
	}

	ctx, cancel := contextFromInteraction()
	defer cancel()

	server, err := b.queries.GetServerByGuildID(ctx, i.GuildID)
	if err != nil {
		respond(s, i, "Distill is not set up for this server yet. Use `/distill setup` first.")
		return
	}

	channels, err := b.queries.ListMonitoredChannels(ctx, server.ID)
	if err != nil {
		respond(s, i, "Failed to fetch status.")
		return
	}

	msg := fmt.Sprintf("**Distill Status**\nServer: %s\nSchedule: `%s`\nMonitored channels: %d\nStatus: %s",
		server.Name, server.ScheduleCron, len(channels), server.Status)
	respond(s, i, msg)
}

func respond(s *discordgo.Session, i *discordgo.InteractionCreate, content string) {
	err := s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseChannelMessageWithSource,
		Data: &discordgo.InteractionResponseData{
			Content: content,
			Flags:   discordgo.MessageFlagsEphemeral,
		},
	})
	if err != nil {
		slog.Error("failed to respond to interaction", "err", err)
	}
}
