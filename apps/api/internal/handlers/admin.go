package handlers

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// AdminListRequests handles GET /api/admin/requests: returns every
// request, newest first, including admin-only fields.
func (h *Handler) AdminListRequests(c *fiber.Ctx) error {
	rows, err := h.DB.Query(c.Context(), `
		SELECT id, email, name, service, urgency, details, status,
		       quote_price::text, quote_date::text, preview_url, admin_notes, created_at, updated_at
		FROM requests
		ORDER BY created_at DESC`)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to load requests")
	}
	defer rows.Close()

	out := make([]requestRow, 0)
	for rows.Next() {
		var r requestRow
		if err := rows.Scan(&r.ID, &r.Email, &r.Name, &r.Service, &r.Urgency, &r.Details,
			&r.Status, &r.QuotePrice, &r.QuoteDate, &r.PreviewURL, &r.AdminNotes, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "failed to read requests")
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to read requests")
	}

	return c.JSON(fiber.Map{"requests": out})
}

// adminUpdateInput lists the only fields an admin may update. Nil fields
// are left untouched.
type adminUpdateInput struct {
	Status     *string  `json:"status"`
	QuotePrice *float64 `json:"quote_price"`
	QuoteDate  *string  `json:"quote_date"`
	PreviewURL *string  `json:"preview_url"`
	AdminNotes *string  `json:"admin_notes"`
}

// AdminUpdateRequest handles PUT /api/admin/requests/:id: partial update
// restricted to status, quote_price, quote_date, and admin_notes.
func (h *Handler) AdminUpdateRequest(c *fiber.Ctx) error {
	id := c.Params("id")
	if !isUUID(id) {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request id")
	}

	var in adminUpdateInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	sets := make([]string, 0, 4)
	args := make([]any, 0, 5)
	add := func(column string, value any) {
		args = append(args, value)
		sets = append(sets, fmt.Sprintf("%s = $%d", column, len(args)))
	}

	if in.Status != nil {
		status := strings.TrimSpace(*in.Status)
		if !validStatuses[status] {
			return fiber.NewError(fiber.StatusBadRequest,
				"status must be one of submitted, quoted, in_progress, delivered, declined")
		}
		add("status", status)
	}
	if in.QuotePrice != nil {
		if *in.QuotePrice < 0 {
			return fiber.NewError(fiber.StatusBadRequest, "quote_price must be non-negative")
		}
		add("quote_price", *in.QuotePrice)
	}
	if in.QuoteDate != nil {
		quoteDate := strings.TrimSpace(*in.QuoteDate)
		if _, err := time.Parse("2006-01-02", quoteDate); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "quote_date must be formatted YYYY-MM-DD")
		}
		add("quote_date", quoteDate)
	}
	if in.PreviewURL != nil {
		add("preview_url", strings.TrimSpace(*in.PreviewURL))
	}
	if in.AdminNotes != nil {
		add("admin_notes", *in.AdminNotes)
	}

	if len(sets) == 0 {
		return fiber.NewError(fiber.StatusBadRequest,
			"provide at least one of status, quote_price, quote_date, admin_notes")
	}

	args = append(args, id)
	query := fmt.Sprintf(
		"UPDATE requests SET %s, updated_at = now() WHERE id = $%d",
		strings.Join(sets, ", "), len(args),
	)

	tag, err := h.DB.Exec(c.Context(), query, args...)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to update request")
	}
	if tag.RowsAffected() == 0 {
		return fiber.NewError(fiber.StatusNotFound, "request not found")
	}

	return c.JSON(fiber.Map{"ok": true})
}
