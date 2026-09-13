package handlers

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/amanasmuei/devdesk-platform/apps/api/internal/notify"
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

// adminUpdateInput lists the only fields an admin may update. A present
// but null field clears the column; an absent field leaves it untouched.
// Fields are value types (not pointers) so that an explicit JSON null
// still invokes UnmarshalJSON and records Set=true.
type adminUpdateInput struct {
	Status     string       `json:"status"`
	QuotePrice nullableNum  `json:"quote_price"`
	QuoteDate  nullableStr  `json:"quote_date"`
	PreviewURL nullableStr  `json:"preview_url"`
	AdminNotes nullableStr  `json:"admin_notes"`
}

// nullableStr distinguishes "field absent" (Set=false) from "field set
// to null/empty" (Set=true, Value=nil), so the admin panel can clear a
// value without re-sending everything.
type nullableStr struct {
	Set   bool
	Value *string
}

func (n *nullableStr) UnmarshalJSON(b []byte) error {
	n.Set = true
	if string(b) == "null" {
		return nil
	}
	var v string
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	n.Value = &v
	return nil
}

// nullableNum is nullableStr for numeric fields.
type nullableNum struct {
	Set   bool
	Value *float64
}

func (n *nullableNum) UnmarshalJSON(b []byte) error {
	n.Set = true
	if string(b) == "null" {
		return nil
	}
	var v float64
	if err := json.Unmarshal(b, &v); err != nil {
		return err
	}
	n.Value = &v
	return nil
}

// AdminUpdateRequest handles PUT /api/admin/requests/:id: partial update
// of status (one step up the ladder only), quote fields, preview URL,
// and admin notes. Setting the status to quoted or delivered triggers a
// best-effort client notification email.
func (h *Handler) AdminUpdateRequest(c *fiber.Ctx) error {
	id := c.Params("id")
	if !isUUID(id) {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request id")
	}

	var in adminUpdateInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	sets := make([]string, 0, 5)
	args := make([]any, 0, 6)
	add := func(column string, value any) {
		args = append(args, value)
		sets = append(sets, fmt.Sprintf("%s = $%d", column, len(args)))
	}

	// Load current row for transition validation and notifications.
	var (
		curStatus string
		name      string
		email     string
		service   string
		curPrice  *string
		curDate   *string
	)
	err := h.DB.QueryRow(c.Context(),
		`SELECT status, name, email, service, quote_price::text, quote_date::text
		 FROM requests WHERE id = $1`, id,
	).Scan(&curStatus, &name, &email, &service, &curPrice, &curDate)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "request not found")
	}

	newStatus := curStatus
	if in.Status != "" {
		status := strings.TrimSpace(in.Status)
		if !validStatus(status) {
			return fiber.NewError(fiber.StatusBadRequest, "unknown status: "+status)
		}
		if status != curStatus {
			// The client-owned transitions (accept/decline) are never done
			// by the admin; the admin walks the forward ladder one step at
			// a time.
			if adminNext[curStatus] != status {
				return fiber.NewError(fiber.StatusConflict,
					"cannot move a "+curStatus+" request to "+status+
						"; allowed next status is "+adminNext[curStatus])
			}
			newStatus = status
		}
		add("status", status)
	}

	var newPrice, newDate *string
	if in.QuotePrice.Set {
		if in.QuotePrice.Value == nil {
			newPrice = nil // cleared
		} else {
			if *in.QuotePrice.Value < 0 {
				return fiber.NewError(fiber.StatusBadRequest, "quote_price must be non-negative")
			}
			v := *in.QuotePrice.Value
			s := strconv.FormatFloat(v, 'f', -1, 64)
			newPrice = &s
		}
		add("quote_price", nullableVal(newPrice))
	}
	if in.QuoteDate.Set {
		if in.QuoteDate.Value == nil || strings.TrimSpace(*in.QuoteDate.Value) == "" {
			newDate = nil
		} else {
			d := strings.TrimSpace(*in.QuoteDate.Value)
			if _, err := time.Parse("2006-01-02", d); err != nil {
				return fiber.NewError(fiber.StatusBadRequest, "quote_date must be formatted YYYY-MM-DD")
			}
			newDate = &d
		}
		add("quote_date", nullableVal(newDate))
	}
	if in.PreviewURL.Set {
		if in.PreviewURL.Value == nil {
			add("preview_url", nil)
		} else {
			u := strings.TrimSpace(*in.PreviewURL.Value)
			if !isSafePreviewURL(u) {
				return fiber.NewError(fiber.StatusBadRequest,
					"preview_url must be an absolute http(s) URL")
			}
			if u == "" {
				add("preview_url", nil)
			} else {
				add("preview_url", u)
			}
		}
	}
	if in.AdminNotes.Set {
		if in.AdminNotes.Value == nil {
			add("admin_notes", nil)
		} else {
			add("admin_notes", *in.AdminNotes.Value)
		}
	}

	if len(sets) == 0 {
		return fiber.NewError(fiber.StatusBadRequest,
			"provide at least one of status, quote_price, quote_date, preview_url, admin_notes")
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

	// Best-effort client notifications on the two client-facing events.
	if h.Mailer != nil && h.Mailer.Enabled() && newStatus != curStatus {
		switch newStatus {
		case "quoted":
			price, date := "", ""
			if newPrice != nil {
				price = *newPrice
			} else if curPrice != nil {
				price = *curPrice
			}
			if newDate != nil {
				date = *newDate
			} else if curDate != nil {
				date = *curDate
			}
			h.Mailer.SendAsync(email, "DevDesk — your quote is ready",
				notify.QuoteBody(name, service, price, date))
		case "delivered":
			p := ""
			if in.PreviewURL.Set && in.PreviewURL.Value != nil {
				p = strings.TrimSpace(*in.PreviewURL.Value)
			}
			h.Mailer.SendAsync(email, "DevDesk — your work is ready",
				notify.DeliveredBody(name, service, p))
		}
	}

	return c.JSON(fiber.Map{"ok": true, "status": newStatus})
}

// nullableVal converts a *string to any for pgx query args (nil clears
// the column).
func nullableVal(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}
