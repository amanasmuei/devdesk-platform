// Command api is the DevDesk platform backend: a Fiber v2 HTTP service
// backed by Postgres with email+password auth and HttpOnly JWT sessions.
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/amanasmuei/devdesk-platform/apps/api/internal/auth"
	"github.com/amanasmuei/devdesk-platform/apps/api/internal/db"
	"github.com/amanasmuei/devdesk-platform/apps/api/internal/handlers"
	"github.com/amanasmuei/devdesk-platform/apps/api/internal/middleware"
	"github.com/amanasmuei/devdesk-platform/apps/api/internal/notify"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	v := strings.ToLower(os.Getenv(key))
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

// ensureAdminUser creates the admin account from ADMIN_EMAIL and
// ADMIN_PASSWORD if it does not already exist.
func ensureAdminUser(ctx context.Context, pool *pgxpool.Pool, email, password string) error {
	email = strings.ToLower(strings.TrimSpace(email))

	var exists bool
	if err := pool.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email,
	).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO users (email, password_hash, is_admin)
		 VALUES ($1, $2, true)
		 ON CONFLICT (email) DO NOTHING`,
		email, hash,
	); err != nil {
		return err
	}
	log.Printf("bootstrapped admin user %s", email)
	return nil
}

func main() {
	port := envOr("PORT", "8080")
	databaseURL := os.Getenv("DATABASE_URL")
	jwtSecret := os.Getenv("JWT_SECRET")
	webOrigin := envOr("WEB_ORIGIN", "http://localhost:3000")
	secureCookies := envBool("COOKIE_SECURE", false)

	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrations failed: %v", err)
	}

	adminEmail := strings.ToLower(strings.TrimSpace(envOr("ADMIN_EMAIL", "")))
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminEmail != "" && adminPassword != "" {
		if err := ensureAdminUser(ctx, pool, adminEmail, adminPassword); err != nil {
			log.Fatalf("admin bootstrap failed: %v", err)
		}
	} else {
		log.Println("ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping admin bootstrap")
	}

	mailer := notify.NewFromEnv()

	app := fiber.New(fiber.Config{
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			} else {
				// Never leak internal error details to clients.
				log.Printf("internal error on %s %s: %v", c.Method(), c.Path(), err)
				err = fiber.NewError(code, "internal server error")
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} ${status} ${latency} ${ip} ${method} ${path}\n",
	}))

	app.Use(cors.New(cors.Config{
		AllowOrigins:     webOrigin,
		AllowCredentials: true,
		AllowHeaders:     "Content-Type",
		AllowMethods:     "GET,POST,PUT,OPTIONS",
	}))

	h := &handlers.Handler{
		DB:            pool,
		JWTSecret:     jwtSecret,
		SecureCookies: secureCookies,
		Mailer:        mailer,
	}

	// Make the admin notification address available to handlers.
	withAdminEmail := func(c *fiber.Ctx) error {
		if adminEmail != "" {
			c.Locals("adminEmail", adminEmail)
		}
		return c.Next()
	}

	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Public routes (rate-limited: the form is internet-facing).
	app.Post("/api/requests", middleware.RateLimit(10, 10), withAdminEmail, h.CreateRequest)

	// Auth routes (stricter limit: brute-force protection).
	authLimiter := middleware.RateLimit(10, 5)
	app.Post("/api/auth/register", authLimiter, h.Register)
	app.Post("/api/auth/login", authLimiter, h.Login)
	app.Post("/api/auth/logout", h.Logout)
	app.Get("/api/auth/me", middleware.RequireAuth(jwtSecret), h.Me)

	// Client portal routes.
	app.Get("/api/portal/requests", middleware.RequireAuth(jwtSecret), h.PortalRequests)
	app.Post("/api/portal/requests/:id/decision",
		middleware.RequireAuth(jwtSecret), withAdminEmail, h.ClientDecide)

	// Admin routes.
	app.Get("/api/admin/requests", middleware.RequireAuth(jwtSecret), middleware.RequireAdmin, h.AdminListRequests)
	app.Put("/api/admin/requests/:id",
		middleware.RequireAuth(jwtSecret), middleware.RequireAdmin, h.AdminUpdateRequest)

	// Graceful shutdown on SIGINT/SIGTERM.
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, os.Interrupt)
		<-sig
		log.Println("shutting down…")
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := app.ShutdownWithContext(shutdownCtx); err != nil {
			log.Printf("shutdown error: %v", err)
		}
	}()

	log.Fatal(app.Listen(":" + port))
}
