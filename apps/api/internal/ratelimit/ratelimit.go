// Package ratelimit provides a Redis-backed fixed-window rate limiter
// and a chi middleware that applies it per authenticated user (or per
// client IP when unauthenticated).
package ratelimit

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/sislelabs/distill/apps/api/internal/auth"
)

// Limiter wraps a Redis client with a fixed-window counter.
type Limiter struct {
	rdb    *redis.Client
	limit  int
	window time.Duration
}

// New builds a Limiter from a redis:// URL. A nil/empty URL or an
// unparseable one yields a nil Limiter — callers must treat a nil
// Limiter as "no limiting" (fail-open).
func New(redisURL string, limit int, window time.Duration) *Limiter {
	if redisURL == "" {
		slog.Warn("ratelimit: REDIS_URL empty — rate limiting disabled")
		return nil
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		slog.Error("ratelimit: bad REDIS_URL — rate limiting disabled", "err", err)
		return nil
	}
	return &Limiter{rdb: redis.NewClient(opt), limit: limit, window: window}
}

// allow increments the fixed-window counter for key and reports whether
// the request is under the limit. On any Redis error it fails OPEN
// (returns true) — a limiter outage must never take down the API.
func (l *Limiter) allow(ctx context.Context, key string) bool {
	fullKey := "ratelimit:" + key
	pipe := l.rdb.TxPipeline()
	incr := pipe.Incr(ctx, fullKey)
	pipe.Expire(ctx, fullKey, l.window)
	if _, err := pipe.Exec(ctx); err != nil {
		slog.Warn("ratelimit: redis error, failing open", "err", err)
		return true
	}
	return incr.Val() <= int64(l.limit)
}

// Middleware returns a chi-compatible middleware enforcing the limit.
// The bucket key is the authenticated user ID when present, else the
// client IP. A nil Limiter returns a pass-through middleware.
func (l *Limiter) Middleware(next http.Handler) http.Handler {
	if l == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := clientKey(r)
		if !l.allow(r.Context(), key) {
			w.Header().Set("Retry-After", strconv.Itoa(int(l.window.Seconds())))
			http.Error(w, `{"error":"rate limit exceeded — slow down"}`, http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientKey prefers the authenticated user ID; falls back to the IP.
func clientKey(r *http.Request) string {
	if uid, ok := auth.UserIDFromContext(r.Context()); ok {
		return "user:" + uid.String()
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return "ip:" + host
}
