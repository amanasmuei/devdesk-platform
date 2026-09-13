package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// ClientDecide handles POST /api/portal/requests/:id/decision: lets the
// signed-in client accept or decline a quoted request. Only the owner may
// decide, only while the request is quoted, and declining is possible at
// any earlier stage too (before work starts).
func (h *Handler) ClientDecide(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	id := c.Params("id")
	if !isUUID(id) {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request id")
	}

	var in struct {
		Decision string `json:"decision"`
	}
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	in.Decision = strings.ToLower(strings.TrimSpace(in.Decision))
	if in.Decision != "accept" && in.Decision != "decline" {
		return fiber.NewError(fiber.StatusBadRequest, "decision must be accept or decline")
	}

	newStatus := "accepted"
	if in.Decision == "decline" {
		newStatus = "declined"
	}

	tag, err := h.DB.Exec(c.Context(), `
		UPDATE requests
		SET status = $1, updated_at = now()
		WHERE id = $2
		  AND (client_id = $3 OR email = $4)
		  AND (status = 'quoted' OR ($1 = 'declined' AND status = 'submitted'))`,
		newStatus, id, userID, c.Locals("email"))
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update request")
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "request not found or not in a decidable state")
	}

	return c.JSON(fiber.Map{"ok": true, "status": newStatus})
}

// user's own requests. Unclaimed rows whose email matches the user's
// email are claimed (client_id set) on read.
func (h *Handler) PortalRequests(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(string)
	email, _ := c.Locals("email").(string)
	ctx := c.Context()

	// Claim any unclaimed requests submitted with this user's email.
	if _, err := h.DB.Exec(ctx,
		"UPDATE requests SET client_id = $1 WHERE email = $2 AND client_id IS NULL",
		userID, email,
	); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to link requests")
	}

	rows, err := h.DB.Query(ctx, `
		SELECT id, email, name, service, urgency, details, status,
		       quote_price::text, quote_date::text, preview_url, created_at, updated_at
		FROM requests
		WHERE client_id = $1 OR email = $2
		ORDER BY created_at DESC`, userID, email)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load requests")
	}
	defer rows.Close()

	out := make([]requestRow, 0)
	for rows.Next() {
		var r requestRow
		if err := rows.Scan(&r.ID, &r.Email, &r.Name, &r.Service, &r.Urgency, &r.Details,
			&r.Status, &r.QuotePrice, &r.QuoteDate, &r.PreviewURL, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to read requests")
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to read requests")
	}

	return c.JSON(fiber.Map{"requests": out})
}
