// Package middleware provides Fiber middleware for authenticating
// requests via the session cookie and gating admin-only routes.
package middleware

import (
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
