package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/amanasmuei/devdesk-platform/apps/api/internal/auth"
)

type loginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login handles POST /api/auth/login: verifies email and password,
// then sets the HttpOnly session cookie.
func (h *Handler) Login(c *fiber.Ctx) error {
	var in loginInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if in.Email == "" || in.Password == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email and password are required")
	}
	if len(in.Password) > auth.MaxPasswordLength {
		return fiber.NewError(fiber.StatusBadRequest,
			"password must be at most 72 characters")
	}

	var (
		id      string
		hash    string
		isAdmin bool
	)
	err := h.DB.QueryRow(c.Context(),
		"SELECT id, password_hash, is_admin FROM users WHERE email = $1", in.Email,
	).Scan(&id, &hash, &isAdmin)
	if err != nil || !auth.VerifyPassword(in.Password, hash) {
		return fiber.NewError(fiber.StatusUnauthorized, "invalid email or password")
	}

	// Claim any anonymous wizard submissions made with this email so the
	// portal shows them immediately after login.
	if _, err := h.DB.Exec(c.Context(),
		"UPDATE requests SET client_id = $1 WHERE email = $2 AND client_id IS NULL",
		id, in.Email,
	); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to link requests")
	}

	token, err := auth.GenerateToken(id, in.Email, isAdmin, h.JWTSecret, auth.SessionTTL)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create session")
	}
	auth.SetSessionCookie(c, token, h.SecureCookies)

	return c.JSON(fiber.Map{"id": id, "email": in.Email, "is_admin": isAdmin})
}

// Register handles POST /api/auth/register: creates a client account
// (never admin), then sets the session cookie. After registering with
// the same email used for a wizard submission, the portal read path
// claims those requests automatically.
func (h *Handler) Register(c *fiber.Ctx) error {
	var in loginInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if in.Email == "" || in.Password == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email and password are required")
	}
	if len(in.Password) < 8 {
		return fiber.NewError(fiber.StatusBadRequest, "password must be at least 8 characters")
	}
	if len(in.Password) > auth.MaxPasswordLength {
		return fiber.NewError(fiber.StatusBadRequest,
			"password must be at most 72 characters")
	}

	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create account")
	}

	var id string
	err = h.DB.QueryRow(c.Context(),
		"INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id",
		in.Email, hash,
	).Scan(&id)
	if err != nil {
		return fiber.NewError(fiber.StatusConflict, "an account with this email already exists")
	}

	token, err := auth.GenerateToken(id, in.Email, false, h.JWTSecret, auth.SessionTTL)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create session")
	}
	auth.SetSessionCookie(c, token, h.SecureCookies)

	return c.JSON(fiber.Map{"id": id, "email": in.Email, "is_admin": false})
}

// Logout handles POST /api/auth/logout: expires the session cookie.
func (h *Handler) Logout(c *fiber.Ctx) error {
	auth.ClearSessionCookie(c, h.SecureCookies)
	return c.JSON(fiber.Map{"ok": true})
}

// Me handles GET /api/auth/me: returns the authenticated user,
// re-reading email and admin flag from the database.
func (h *Handler) Me(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)

	var (
		email   string
		isAdmin bool
	)
	err := h.DB.QueryRow(c.Context(),
		"SELECT email, is_admin FROM users WHERE id = $1", userID,
	).Scan(&email, &isAdmin)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "user no longer exists")
	}

	return c.JSON(fiber.Map{"id": userID, "email": email, "is_admin": isAdmin})
}
