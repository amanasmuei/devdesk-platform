package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// PortalRequests handles GET /api/portal/requests: returns the signed-in
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
		       quote_price::text, quote_date::text, created_at, updated_at
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
			&r.Status, &r.QuotePrice, &r.QuoteDate, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to read requests")
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to read requests")
	}

	return c.JSON(fiber.Map{"requests": out})
}
