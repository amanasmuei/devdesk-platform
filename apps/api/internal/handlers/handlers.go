// Package handlers contains the HTTP handlers for the DevDesk API.
package handlers

import (
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/amanasmuei/devdesk-platform/apps/api/internal/notify"
)

// Handler carries shared dependencies for all route handlers.
type Handler struct {
	DB            *pgxpool.Pool
	JWTSecret     string
	SecureCookies bool
	Mailer        *notify.Mailer
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
	PreviewURL *string   `json:"preview_url,omitempty"`
	AdminNotes *string   `json:"admin_notes,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

var uuidPattern = regexp.MustCompile(
	`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func isUUID(s string) bool {
	return uuidPattern.MatchString(s)
}

// The status ladder every request follows:
//
//	submitted → quoted → accepted → in_progress → delivered → paid
//	   \__________/          \
//	    (client decline)      \ (client decline before work starts)
//
// clientDecide covers the client-owned transitions; adminNext covers
// the admin-owned forward transitions. No skipping, no going backwards.
var adminNext = map[string]string{
	"submitted":   "quoted",
	"quoted":      "accepted", // manual override only; normally via client decision
	"accepted":    "in_progress",
	"in_progress": "delivered",
	"delivered":   "paid",
}

func clientDecide(from, decision string) (string, bool) {
	if decision == "accept" && from == "quoted" {
		return "accepted", true
	}
	if decision == "decline" && (from == "submitted" || from == "quoted") {
		return "declined", true
	}
	return "", false
}

func validStatus(s string) bool {
	switch s {
	case "submitted", "quoted", "accepted", "in_progress", "delivered", "paid", "declined":
		return true
	}
	return false
}

// isSafePreviewURL accepts only absolute http(s) URLs. javascript:,
// data:, and other schemes are rejected because the URL is rendered as
// a clickable link in the client portal.
func isSafePreviewURL(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return true // clearing the field is fine
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	scheme := strings.ToLower(u.Scheme)
	return (scheme == "http" || scheme == "https") && u.Host != ""
}
