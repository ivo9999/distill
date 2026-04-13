# Distill

Your Discord wrote your newsletter this week.

## Development

```bash
docker-compose up postgres
cd apps/api && go run ./cmd/api
cd apps/web && pnpm dev
```

## Architecture

- `apps/api/` — Go backend (HTTP API, Discord bot, River worker)
- `apps/web/` — Next.js frontend + LLM pipeline
- `scripts/experiment/` — CLI for testing LLM pipeline
