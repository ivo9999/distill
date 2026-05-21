package config

import (
	"fmt"
	"os"
	"strings"
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
	RedisURL            string
	LogLevel            string
	AdminUserIDs        []string
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
		RedisURL:            os.Getenv("REDIS_URL"),
		LogLevel:            os.Getenv("LOG_LEVEL"),
	}
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	// Fail fast on a misconfigured deploy rather than booting into
	// confusing runtime errors. These secrets are all required for the
	// app to function correctly.
	required := map[string]string{
		"DISCORD_BOT_TOKEN":      c.DiscordBotToken,
		"INTERNAL_API_KEY":       c.InternalAPIKey,
		"STRIPE_SECRET_KEY":      c.StripeSecretKey,
		"STRIPE_WEBHOOK_SECRET":  c.StripeWebhookSecret,
		"DISTILL_ENCRYPTION_KEY": c.EncryptionKey,
	}
	for name, val := range required {
		if val == "" {
			return nil, fmt.Errorf("%s is required", name)
		}
	}
	if c.LogLevel == "" {
		c.LogLevel = "info"
	}
	if adminIDs := os.Getenv("ADMIN_USER_IDS"); adminIDs != "" {
		for _, id := range strings.Split(adminIDs, ",") {
			if trimmed := strings.TrimSpace(id); trimmed != "" {
				c.AdminUserIDs = append(c.AdminUserIDs, trimmed)
			}
		}
	}
	return c, nil
}
