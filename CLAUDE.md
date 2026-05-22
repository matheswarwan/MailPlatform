# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MailPlatform is an email marketing platform built on AWS-native services. It supports campaigns, audience segmentation, automations, analytics, and a subscriber preference centre.

## Commands

### Frontend (in `frontend/`)
```bash
npm run dev       # Dev server on port 3000 (proxies /api to localhost:3001)
npm run build     # Production build
npm run preview   # Preview production build
```

### Backend (in `backend/`)
```bash
npm run dev       # Dev server on port 3001 with auto-restart (node --watch)
npm run start     # Production start
npm run migrate   # Run database migrations
```

### First-time setup
Copy `backend/.env.example` to `backend/.env` and fill in values. See `docs/app-setup.md` for full local setup and `docs/setup-aws.md` for AWS infrastructure provisioning.

## Architecture

### Stack
- **Frontend**: React 18 + Vite + Tailwind CSS + Zustand + React Router v6 + Axios
- **Backend**: Fastify 4 + PostgreSQL (raw SQL via `pg`, no ORM) + JWT auth
- **AWS**: SES (email sending), S3 (assets), SNS (event webhooks), RDS (PostgreSQL)

### Frontend → Backend Communication
- Axios client at `frontend/src/api/client.js` — base URL `/api`, auto-injects JWT Bearer token, 401s trigger logout
- Vite proxies `/api/*` → `http://localhost:3001` in dev

### State Management
Two Zustand stores:
- `authStore.js` — token, user object, login/logout
- `appStore.js` — contacts, campaigns, segments, automations, analytics, preference config

### Routing
React Router v6 with a `ProtectedLayout` wrapper (checks token, redirects to `/login`). Public routes: `/login`, `/preferences/:token`.

### Backend Structure
- `src/index.js` — Fastify app, plugins (CORS, Helmet, multipart), route registration, graceful shutdown
- `src/routes/` — HTTP handlers (auth, contacts, campaigns, templates, automations, analytics, preferences, webhooks)
- `src/services/` — Business logic: `emailService.js` (SES sending), `campaignEngine.js` (campaign dispatch), `templateService.js` (MJML rendering)
- `src/config/` — `database.js` (pg Pool, auto-SSL for RDS), `aws.js` (SES/S3/SNS clients)
- `src/middleware/auth.js` — JWT verification for protected routes

### Database
PostgreSQL with 8 tables: `accounts`, `contacts`, `segments`, `templates`, `campaigns`, `sends`, `automations`, `preferences`. Single migration file: `migrations/001_initial_schema.sql` (idempotent). Run via `npm run migrate`.

### Email Templates
Templates use MJML blocks. The `templateService` renders MJML → HTML before sending via SES. Assets (logos, images) are stored in S3.

### SNS Webhooks
SES events (bounces, deliveries, opens, clicks) are forwarded via SNS to the `/api/webhooks/sns` endpoint. In local dev, use ngrok to expose this endpoint.

## Key Constraints
- No ORM — write raw SQL. Use parameterized queries to prevent injection.
- AWS infrastructure setup is manual (no Terraform/Docker Compose). Follow `docs/setup-aws.md`.
- JWT expiry is 7 days; tokens are stored in Zustand (in-memory, not localStorage).


# Additional rules by Mathes - will keep adding more.

# Claude Rules

1. Since we're in development phase, always show all error details as much as possible in UI. If there's a stacktrace, provide option to copy them (don't have to show the trace but copy).

2. Keep updating 'docs' as and when necessary.

3. After a signifiant piece of work is done, push the code the git unless we're not working on main branch.