# DevDesk Platform — v1 Scope

Next.js frontend + Go Fiber backend + Postgres (self-hosted, Docker Compose).

## v1 scope — feature parity with current site
- Landing page (port existing design: dark theme, Inter, minimal, no icons/emoji in UI)
- Quote wizard (4 steps: service → details → urgency → contact) → POST /api/requests
- Client portal: email+password login, list own requests, see status + quote
- Admin panel: login, list all requests, edit status/quote/notes
- No PDF invoicing, no chat, no file uploads in v1 (later)

## Stack decisions (user-confirmed)
- Monorepo: `apps/web` (Next.js), `apps/api` (Go Fiber)
- Postgres self-hosted in Docker Compose on VPS
- Auth: email + password (bcrypt), session via HttpOnly cookie JWT
- Single deployment: Caddy reverse proxy → Next.js + Go API

## Design language (carried over)
- Dark theme, Inter font, tight tracking, white primary buttons, wordmark only, no emojis/icons in UI
