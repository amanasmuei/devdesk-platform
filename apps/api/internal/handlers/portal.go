package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/amanasmuei/devdesk-platform/apps/api/internal/notify"
)

// ClientDecide handles POST /api/portal/requests/:id/decision: lets the
// signed-in client accept or decline a quoted request. Only the owner
// may decide; accept only from quoted, decline from submitted/quoted.
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

	// Read current state first so the transition can be validated against
	// the ladder and the admin can be notified with the request details.
	var (
		curStatus string
		name      string
		email     string
		service   string
		quote     *string
	)
	err := h.DB.QueryRow(c.Context(),
		`SELECT status, name, email, service, quote_price::text
		 FROM requests
		 WHERE id = $1 AND (client_id = $2 OR email = $3)`,
		id, userID, c.Locals("email"),
	).Scan(&curStatus, &name, &email, &service, &quote)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "request not found")
	}

	newStatus, ok := clientDecide(curStatus, in.Decision)
	if !ok {
		return fiber.NewError(fiber.StatusConflict,
			"this request cannot be "+in.Decision+"ed while it is "+curStatus)
	}

	tag, err := h.DB.Exec(c.Context(), `
		UPDATE requests
		SET status = $1, updated_at = now()
		WHERE id = $2 AND status = $3`,
		newStatus, id, curStatus)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update request")
	}
	if tag.RowsAffected() == 0 {
		// Concurrent update changed the state; surface a conflict.
		return fiber.NewError(fiber.StatusConflict, "request state changed, reload and try again")
	}

	// Best-effort admin notification.
	if h.Mailer != nil && h.Mailer.Enabled() {
		if adminEmail, _ := c.Locals("adminEmail").(string); adminEmail != "" {
			if newStatus == "accepted" {
				q := ""
				if quote != nil {
					q = *quote
				}
				h.Mailer.SendAsync(adminEmail, "DevDesk — quote accepted by "+name,
					notify.AcceptedBody(name, email, service, q))
			} else {
				h.Mailer.SendAsync(adminEmail, "DevDesk — request declined by "+name,
					notify.DeclinedBody(name, email, service))
			}
		}
	}

	return c.JSON(fiber.Map{"ok": true, "status": newStatus})
}

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
