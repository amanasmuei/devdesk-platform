// Package notify provides best-effort transactional email via SMTP.
// It is intentionally fail-open: a mailer with no SMTP_HOST configured
// is disabled and SendAsync becomes a no-op, so the API never fails a
// request because email delivery failed.
package notify

import (
	"context"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
	"time"
)

// Mailer sends plain-text transactional email over SMTP (STARTTLS or
// plain, authenticated with PLAIN when credentials are set).
type Mailer struct {
	host     string
	port     string
	username string
	password string
	from     string
	enabled  bool
}

// NewFromEnv builds a Mailer from SMTP_* environment variables.
// With SMTP_HOST empty the mailer is disabled and all sends are no-ops.
func NewFromEnv() *Mailer {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	m := &Mailer{
		host:     host,
		port:     envOr("SMTP_PORT", "587"),
		username: os.Getenv("SMTP_USER"),
		password: os.Getenv("SMTP_PASS"),
		from:     envOr("SMTP_FROM", "no-reply@devdesk.local"),
		enabled:  host != "",
	}
	if !m.enabled {
		log.Println("notify: SMTP_HOST not set; email notifications disabled")
	}
	return m
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

// Enabled reports whether SMTP is configured.
func (m *Mailer) Enabled() bool { return m.enabled }

// SendAsync delivers an email in the background with a hard timeout so a
// slow SMTP server can never stall an HTTP request. Failures are logged
// and swallowed.
func (m *Mailer) SendAsync(to, subject, body string) {
	if !m.enabled || strings.TrimSpace(to) == "" {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		done := make(chan error, 1)
		go func() { done <- m.send(to, subject, body) }()

		select {
		case err := <-done:
			if err != nil {
				log.Printf("notify: failed to send %q to %s: %v", subject, to, err)
			}
		case <-ctx.Done():
			log.Printf("notify: timed out sending %q to %s", subject, to)
		}
	}()
}

func (m *Mailer) send(to, subject, body string) error {
	addr := fmt.Sprintf("%s:%s", m.host, m.port)

	var auth smtp.Auth
	if m.username != "" {
		auth = smtp.PlainAuth("", m.username, m.password, m.host)
	}

	msg := strings.Join([]string{
		"From: DevDesk <" + m.from + ">",
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"",
		body,
	}, "\r\n")

	return smtp.SendMail(addr, auth, m.from, []string{to}, []byte(msg))
}
