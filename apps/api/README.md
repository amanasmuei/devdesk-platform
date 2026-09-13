# DevDesk API

Go (Fiber v2) backend for the DevDesk freelance coding service. Postgres
storage, email+password auth with bcrypt, and HttpOnly cookie sessions
carrying a signed JWT.

## Configuration

Copy `.env.example` to `.env` (or export the variables) and adjust:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | no | `8080` | HTTP listen port |
| `DATABASE_URL` | yes | - | Postgres connection string |
| `JWT_SECRET` | yes | - | HMAC secret for session JWTs |
| `ADMIN_EMAIL` | no | - | Admin account bootstrapped on startup if missing |
| `ADMIN_PASSWORD` | no | - | Password for the bootstrap admin |
| `WEB_ORIGIN` | no | `http://localhost:3000` | CORS origin (credentials enabled) |
| `COOKIE_SECURE` | no | `false` | Set `true` behind HTTPS |

Migrations are embedded SQL files in `internal/db/migrations/` and are
applied automatically on startup, tracked in a `schema_migrations` table.

## Run locally

```bash
# Start Postgres (any instance) and create the database:
createdb devdesk

export DATABASE_URL=postgres://$(whoami)@localhost:5432/devdesk?sslmode=disable
export JWT_SECRET=$(openssl rand -hex 32)
export ADMIN_EMAIL=amanasmuei@gmail.com
export ADMIN_PASSWORD=some-strong-password

go mod tidy
go run .
```

The API listens on `http://localhost:8080`.

## Run with Docker

```bash
docker build -t devdesk-api .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgres://devdesk:devdesk@host.docker.internal:5432/devdesk?sslmode=disable \
  -e JWT_SECRET=... \
  -e ADMIN_EMAIL=amanasmuei@gmail.com \
  -e ADMIN_PASSWORD=... \
  devdesk-api
```

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Liveness check |
| POST | `/api/requests` | none | Submit a service request (name, email, service, urgency, details) |
| POST | `/api/auth/login` | none | Email+password login; sets HttpOnly session cookie |
| POST | `/api/auth/logout` | none | Expires the session cookie |
| GET | `/api/auth/me` | session | Current user (id, email, is_admin) |
| GET | `/api/portal/requests` | session | Own requests; unclaimed rows matching the user's email are claimed on read |
| GET | `/api/admin/requests` | admin | All requests, newest first |
| PUT | `/api/admin/requests/:id` | admin | Partial update of status, quote_price, quote_date, admin_notes only |

Sessions are `HttpOnly`, `SameSite=Lax` cookies (`Secure` when
`COOKIE_SECURE=true`), valid for 7 days.

## Project layout

```
main.go                          app wiring, env config, admin bootstrap
internal/db/db.go                pgx pool + embedded migration runner
internal/db/migrations/          SQL migrations
internal/auth/auth.go            bcrypt hashing, JWT sign/verify, cookie helpers
internal/middleware/             requireAuth, requireAdmin
internal/handlers/               public, auth, portal, admin handlers
```
