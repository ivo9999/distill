# Build stage
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o api ./cmd/api
RUN CGO_ENABLED=0 go build -o bot ./cmd/bot
RUN CGO_ENABLED=0 go build -o worker ./cmd/worker
RUN CGO_ENABLED=0 go build -o distill ./cmd/distill

# Final stage
FROM alpine:3.21
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/api .
COPY --from=builder /app/bot .
COPY --from=builder /app/worker .
COPY --from=builder /app/distill .
COPY migrations/ ./migrations/

# Default to API role; bot/worker services override with DISTILL_ROLE.
ENV DISTILL_ROLE=api
ENTRYPOINT ["/app/distill"]
