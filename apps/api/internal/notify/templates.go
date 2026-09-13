package notify

import (
	"strings"
)

// Templates keep client-facing emails short, plain-text, and written in
// the site's voice (no emojis, no icons — text only).

func fmtPrice(price string) string {
	if price == "" {
		return "(to be confirmed)"
	}
	return "RM " + price
}

// NewRequestClientBody confirms submission to the client.
func NewRequestClientBody(name, service string) string {
	return strings.Join([]string{
		"Hi " + firstName(name) + ",",
		"",
		"We received your request (" + service + "). You will get a fixed quote within 24 hours.",
		"",
		"Track it any time in the client portal: create an account with this email at /portal and your request will appear automatically.",
		"",
		"— DevDesk",
	}, "\n")
}

// NewRequestAdminBody notifies the admin about a new request.
func NewRequestAdminBody(name, email, service, urgency, details, reqID string) string {
	return strings.Join([]string{
		"New request received.",
		"",
		"Name:    " + name,
		"Email:   " + email,
		"Service: " + service,
		"Urgency: " + urgency,
		"",
		"Details:",
		details,
		"",
		"Manage it at /admin (request id " + reqID + ").",
	}, "\n")
}

// QuoteBody notifies the client their quote is ready.
func QuoteBody(name, service, price, date string) string {
	lines := []string{
		"Hi " + firstName(name) + ",",
		"",
		"Your quote for " + service + " is ready:",
		"",
		"  Price: " + fmtPrice(price),
	}
	if date != "" {
		lines = append(lines, "  Delivery by: "+date)
	}
	lines = append(lines,
		"",
		"Accept or decline it in the client portal: /portal",
		"",
		"— DevDesk",
	)
	return strings.Join(lines, "\n")
}

// AcceptedBody notifies the admin a client accepted a quote.
func AcceptedBody(name, email, service, price string) string {
	return strings.Join([]string{
		"Quote accepted.",
		"",
		"Client:  " + name + " <" + email + ">",
		"Service: " + service,
		"Price:   " + fmtPrice(price),
		"",
		"Move the request to in_progress at /admin and start work.",
	}, "\n")
}

// DeclinedBody notifies the admin a client declined.
func DeclinedBody(name, email, service string) string {
	return strings.Join([]string{
		"Request declined by client.",
		"",
		"Client:  " + name + " <" + email + ">",
		"Service: " + service,
		"",
		"See details at /admin.",
	}, "\n")
}

// DeliveredBody notifies the client the work is ready to view.
func DeliveredBody(name, service, previewURL string) string {
	lines := []string{
		"Hi " + firstName(name) + ",",
		"",
		"Your " + service + " is ready.",
	}
	if previewURL != "" {
		lines = append(lines, "", "Preview it here:", "  " + previewURL)
	}
	lines = append(lines, "", "See it in your portal: /portal", "", "— DevDesk")
	return strings.Join(lines, "\n")
}

func firstName(full string) string {
	p := strings.Fields(strings.TrimSpace(full))
	if len(p) == 0 {
		return "there"
	}
	return p[0]
}
