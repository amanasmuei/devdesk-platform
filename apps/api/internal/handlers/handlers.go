// Package handlers contains the HTTP handlers for the DevDesk API.
package handlers

import (
	"regexp"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler carries shared dependencies for all route handlers.
type Handler struct {
	DB            *pgxpool.Pool
	JWTSecret     string
	SecureCookies bool
}

// requestRow is the JSON representation of a requests table row.
type requestRow struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	Service    *string   `json:"service"`
	Urgency    *string   `json:"urgency"`
	Details    *string   `json:"details"`
	Status     string    `json:"status"`
	QuotePrice *string   `json:"quote_price"`
	QuoteDate  *string   `json:"quote_date"`
	AdminNotes *string   `json:"admin_notes,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func isUUID(s string) bool {
	return uuidPattern.MatchString(s)
}

var validStatuses = map[string]bool{
	"submitted":   true,
	"quoted":      true,
	"in_progress": true,
	"delivered":   true,
	"declined":    true,
}
