// Command api is the DevDesk platform backend: a Fiber v2 HTTP service
// backed by Postgres with email+password auth and HttpOnly JWT sessions.
package main

import (
	"context"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/amanasmuei/devdesk-platform/apps/api/internal/auth"
	"github.com/amanasmuei/devdesk-platform/apps/api/internal/db"
	"github.com/amanasmuei/devdesk-platform/apps/api/internal/handlers"
	"github.com/amanasmuei/devdesk-platform/apps/api/internal/middleware"
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

	adminEmail := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminEmail != "" && adminPassword != "" {
		if err := ensureAdminUser(ctx, pool, adminEmail, adminPassword); err != nil {
			log.Fatalf("admin bootstrap failed: %v", err)
		}
	} else {
		log.Println("ADMIN_EMAIL or ADMIN_PASSWORD not set; skipping admin bootstrap")
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins:     webOrigin,
		AllowCredentials: true,
		AllowHeaders:     "Content-Type",
		AllowMethods:     "GET,POST,PUT,OPTIONS",
	}))

	h := &handlers.Handler{DB: pool, JWTSecret: jwtSecret, SecureCookies: secureCookies}

	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Public routes.
	app.Post("/api/requests", h.CreateRequest)

	// Auth routes.
	app.Post("/api/auth/register", h.Register)
	app.Post("/api/auth/login", h.Login)
	app.Post("/api/auth/logout", h.Logout)
	app.Get("/api/auth/me", middleware.RequireAuth(jwtSecret), h.Me)

	// Client portal routes.
	app.Get("/api/portal/requests", middleware.RequireAuth(jwtSecret), h.PortalRequests)
	app.Post("/api/portal/requests/:id/decision", middleware.RequireAuth(jwtSecret), h.ClientDecide)

	// Admin routes.
	app.Get("/api/admin/requests", middleware.RequireAuth(jwtSecret), middleware.RequireAdmin, h.AdminListRequests)
	app.Put("/api/admin/requests/:id", middleware.RequireAuth(jwtSecret), middleware.RequireAdmin, h.AdminUpdateRequest)

	log.Fatal(app.Listen(":" + port))
}
