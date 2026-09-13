// Package middleware provides Fiber middleware for authenticating
// requests via the session cookie, gating admin-only routes, and
// rate-limiting abuse-prone endpoints.
package middleware

import (
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/amanasmuei/devdesk-platform/apps/api/internal/auth"
)

// RequireAuth verifies the session cookie and stores userID, email, and
// isAdmin in c.Locals for downstream handlers.
func RequireAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := c.Cookies(auth.SessionCookieName)
		if token == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
		}
		claims, err := auth.ParseToken(token, secret)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired session")
		}
		c.Locals("userID", claims.Subject)
		c.Locals("email", claims.Email)
		c.Locals("isAdmin", claims.IsAdmin)
		return c.Next()
	}
}

// RequireAdmin rejects the request unless the authenticated user is an
// admin. Must run after RequireAuth.
func RequireAdmin(c *fiber.Ctx) error {
	if isAdmin, ok := c.Locals("isAdmin").(bool); ok && isAdmin {
		return c.Next()
	}
	return fiber.NewError(fiber.StatusForbidden, "admin access required")
}

// tokenBucket is a simple fixed-window-free token bucket: a refill rate
// plus a burst capacity per key.
type tokenBucket struct {
	tokens   float64
	lastFill time.Time
}

// rateLimiter is an in-memory sliding token-bucket limiter keyed by
// string (client IP). Suitable for a single-instance deployment.
type rateLimiter struct {
	mu       sync.Mutex
	rate     float64 // tokens per second
	burst    float64 // bucket capacity
	buckets  map[string]*tokenBucket
	lastSweep time.Time
}

func newRateLimiter(ratePerMin, burst int) *rateLimiter {
	return &rateLimiter{
		rate:      float64(ratePerMin) / 60.0,
		burst:     float64(burst),
		buckets:   make(map[string]*tokenBucket),
		lastSweep: time.Now(),
	}
}

// allow consumes one token for the key, refilling lazily first.
func (rl *rateLimiter) allow(key string) bool {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Periodically drop stale buckets so the map cannot grow unbounded.
	if now.Sub(rl.lastSweep) > time.Hour {
		for k, b := range rl.buckets {
			if now.Sub(b.lastFill) > 24*time.Hour {
				delete(rl.buckets, k)
			}
		}
		rl.lastSweep = now
	}

	b, ok := rl.buckets[key]
	if !ok {
		b = &tokenBucket{tokens: rl.burst, lastFill: now}
		rl.buckets[key] = b
	} else {
		b.tokens += now.Sub(b.lastFill).Seconds() * rl.rate
		if b.tokens > rl.burst {
			b.tokens = rl.burst
		}
		b.lastFill = now
	}

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// clientIP returns the peer IP, preferring X-Forwarded-For set by the
// reverse proxy in front of the API.
func clientIP(c *fiber.Ctx) string {
	if fwd := c.Get("X-Forwarded-For"); fwd != "" {
		parts := strings.Split(fwd, ",")
		return strings.TrimSpace(parts[0])
	}
	return c.IP()
}

// RateLimit returns a token-bucket limiter middleware. Exceeding the
// limit answers 429 with Retry-After.
func RateLimit(ratePerMin, burst int) fiber.Handler {
	rl := newRateLimiter(ratePerMin, burst)
	return func(c *fiber.Ctx) error {
		if !rl.allow(clientIP(c)) {
			c.Set("Retry-After", "60")
			return fiber.NewError(fiber.StatusTooManyRequests,
				"too many requests — slow down and try again shortly")
		}
		return c.Next()
	}
}
