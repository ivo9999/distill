package config

import (
	"fmt"
	"os"
)

// Config holds all environment configuration.
type Config struct {
	DatabaseURL         string
	DiscordBotToken     string
	DiscordClientID     string
	DiscordClientSecret string
	DiscordPublicKey    string
	WebInternalBaseURL  string
	InternalAPIKey      string
	StripeSecretKey     string
	StripeWebhookSecret string
	StripePriceID       string
	EncryptionKey       string
	AppBaseURL          string
	LogLevel            string
}

// Load reads config from environment variables.
func Load() (*Config, error) {
	c := &Config{
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		DiscordBotToken:     os.Getenv("DISCORD_BOT_TOKEN"),
		DiscordClientID:     os.Getenv("DISCORD_CLIENT_ID"),
		DiscordClientSecret: os.Getenv("DISCORD_CLIENT_SECRET"),
		DiscordPublicKey:    os.Getenv("DISCORD_PUBLIC_KEY"),
		WebInternalBaseURL:  os.Getenv("WEB_INTERNAL_BASE_URL"),
		InternalAPIKey:      os.Getenv("INTERNAL_API_KEY"),
		StripeSecretKey:     os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
		StripePriceID:       os.Getenv("STRIPE_PRICE_ID_CREATOR"),
		EncryptionKey:       os.Getenv("DISTILL_ENCRYPTION_KEY"),
		AppBaseURL:          os.Getenv("APP_BASE_URL"),
		LogLevel:            os.Getenv("LOG_LEVEL"),
	}
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if c.LogLevel == "" {
		c.LogLevel = "info"
	}
	return c, nil
}
