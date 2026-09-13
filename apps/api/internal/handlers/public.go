package handlers

import (
	"net/mail"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/amanasmuei/devdesk-platform/apps/api/internal/notify"
)

// createRequestInput lists the only fields a public submitter may set.
type createRequestInput struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Service string `json:"service"`
	Urgency string `json:"urgency"`
	Details string `json:"details"`
}

// CreateRequest handles POST /api/requests: public submission of a new
// service request. Only name, email, service, urgency, and details are
// accepted; status and all admin fields keep their defaults.
func (h *Handler) CreateRequest(c *fiber.Ctx) error {
	var in createRequestInput
	if err := c.BodyParser(&in); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.Service = strings.TrimSpace(in.Service)
	in.Urgency = strings.TrimSpace(in.Urgency)
	in.Details = strings.TrimSpace(in.Details)

	if in.Name == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name is required")
	}
	if len(in.Name) > 200 {
		return fiber.NewError(fiber.StatusBadRequest, "name must be at most 200 characters")
	}
	if in.Email == "" {
		return fiber.NewError(fiber.StatusBadRequest, "email is required")
	}
	if _, err := mail.ParseAddress(in.Email); err != nil || len(in.Email) > 320 {
		return fiber.NewError(fiber.StatusBadRequest, "email is not a valid address")
	}
	if in.Service == "" {
		return fiber.NewError(fiber.StatusBadRequest, "service is required")
	}
	if in.Urgency == "" {
		return fiber.NewError(fiber.StatusBadRequest, "urgency is required")
	}
	if in.Details == "" {
		return fiber.NewError(fiber.StatusBadRequest, "details are required")
	}
	if len(in.Details) > 10000 {
		return fiber.NewError(fiber.StatusBadRequest, "details must be at most 10000 characters")
	}

	var id string
	err := h.DB.QueryRow(c.Context(),
		`INSERT INTO requests (email, name, service, urgency, details)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		in.Email, in.Name, in.Service, in.Urgency, in.Details,
	).Scan(&id)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to create request")
	}

	// Best-effort notifications; never fail the request over email.
	if h.Mailer != nil && h.Mailer.Enabled() {
		h.Mailer.SendAsync(in.Email, "DevDesk — we got your request",
			notify.NewRequestClientBody(in.Name, in.Service))

		if adminEmail, _ := c.Locals("adminEmail").(string); adminEmail != "" {
			h.Mailer.SendAsync(adminEmail, "DevDesk — new request from "+in.Name,
				notify.NewRequestAdminBody(in.Name, in.Email, in.Service, in.Urgency, in.Details, id))
		}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"id": id, "status": "submitted"})
}
