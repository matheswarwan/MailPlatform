# MailFlow — Email Marketing Platform

A cloud-native email marketing platform built for small-to-mid-size businesses. Mailchimp-style UX powered by Amazon SES on the backend.

---

## Features

| Tab | What it does |
|-----|-------------|
| **Campaigns** | Build, schedule, and send email campaigns via a 3-step wizard (Setup → Design → Review) |
| **Audience** | Manage segments, import contacts from CSV with field mapping |
| **Automations** | Trigger-based email sequences (welcome series, win-back, birthday, post-purchase) |
| **Analytics** | Open/click/bounce rates, sender reputation health meters, Recharts visualisations |
| **Contacts** | Searchable contact database with tagging, status management, and bulk actions |
| **Preference Centre** | Branded subscriber opt-in/out page with tokenised URLs — satisfies CAN-SPAM, GDPR, CASL |

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Frontend (React 18)            │
│  Campaigns │ Audience │ Automations      │
│  Analytics │ Contacts │ Preference Ctr  │
└─────────────────┬───────────────────────┘
                  │  REST API (/api/*)
┌─────────────────▼───────────────────────┐
│          Backend (Fastify / Node.js)     │
│  Auth · Campaigns · Contacts · Segments │
│  Automations · Analytics · Preferences  │
│  Webhooks (SNS) · MJML renderer         │
└──────┬──────────────┬──────────┬────────┘
       │              │          │
  ┌────▼────┐  ┌──────▼──┐  ┌───▼───┐
  │ AWS SES │  │  RDS    │  │  S3   │
  │ AWS SNS │  │ Postgres│  │ logos │
  └─────────┘  └─────────┘  └───────┘
```

---

## Tech Stack

**Backend**
- [Fastify 4](https://fastify.dev/) — HTTP framework
- [PostgreSQL](https://www.postgresql.org/) via [`pg`](https://node-postgres.com/) — primary database
- [AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/) — SES (email), SNS (events), S3 (assets)
- [MJML](https://mjml.io/) — responsive email template rendering
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) — auth

**Frontend**
- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/) — dark navy design system
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [Recharts](https://recharts.org/) — analytics charts
- [react-dropzone](https://react-dropzone.js.org/) — CSV / logo upload
- [React Router v6](https://reactrouter.com/)

---

## Quick Start (Local)

### 1. Clone and install

```bash
git clone https://github.com/matheswarwan/mailplatform.git
cd mailplatform

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — fill in DATABASE_URL, JWT_SECRET, and AWS credentials
```

See **[docs/setup-aws.md](./docs/setup-aws.md)** for step-by-step AWS provisioning (RDS, SES, SNS, S3).

### 3. Run migrations

```bash
cd backend
npm run migrate
```

Verify the schema was created:

```bash
node src/config/db-check.js
```

### 4. Start the servers

```bash
# Terminal 1 — Backend (http://localhost:3001)
cd backend && npm run dev

# Terminal 2 — Frontend (http://localhost:3000)
cd frontend && npm run dev
```

### 5. Create your first account

There is no registration page in the UI. Use the API once:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@yourcompany.com",
    "password": "yourpassword",
    "name": "Your Name",
    "company": "Your Company"
  }'
```

Then sign in at **http://localhost:3000/login**.

---

## Backend Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with file-watching (development) |
| `npm start` | Start without file-watching (production) |
| `npm run migrate` | Create / update database tables |
| `node src/config/db-check.js` | Inspect schema and row counts |

---

## Project Structure

```
MailPlatform/
├── backend/
│   ├── src/
│   │   ├── config/          # DB pool, AWS clients, migrate, db-check
│   │   ├── middleware/       # JWT auth
│   │   ├── routes/          # auth, contacts, campaigns, segments,
│   │   │                    # automations, analytics, preferences, webhooks
│   │   └── services/        # emailService (SES), templateService (MJML),
│   │                        # campaignEngine, suppressionService, preferenceService
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client with JWT interceptors
│   │   ├── store/           # Zustand: authStore, appStore
│   │   ├── components/
│   │   │   ├── layout/      # Sidebar, Header
│   │   │   ├── ui/          # Button, Badge, Modal, StatCard
│   │   │   └── campaigns/   # CampaignBuilder (3-step wizard)
│   │   └── pages/           # Campaigns, Audience, Automations, Analytics,
│   │                        # Contacts, PreferenceCentre, PreferencePage, Login
│   └── package.json
└── docs/
    ├── setup-aws.md         # AWS provisioning + production deployment
    └── app-setup.md         # Local dev setup
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current account info |
| GET/POST | `/api/contacts` | List / create contacts |
| POST | `/api/contacts/import` | Bulk import from CSV |
| GET/POST | `/api/campaigns` | List / create campaigns |
| POST | `/api/campaigns/:id/send` | Send campaign via SES |
| POST | `/api/campaigns/:id/schedule` | Schedule campaign |
| GET | `/api/analytics/overview` | Aggregate send metrics |
| GET/PUT | `/api/preferences/config` | Preference centre branding |
| GET/POST | `/api/p/:token` | Public subscriber preference page |
| POST | `/api/webhooks/ses` | SNS event receiver (bounces, opens, clicks) |

---

## Compliance

Every email sent through MailFlow automatically includes:
- Unsubscribe link (enforced at render time — cannot be removed)
- Preference centre link (tokenised JWT, 90-day expiry)
- Suppression list enforcement (hard bounces and complaints auto-suppressed)

Satisfies **CAN-SPAM**, **GDPR**, and **CASL** requirements.

---

## Docs

- [AWS Setup Guide](./docs/setup-aws.md) — provision RDS, SES, SNS, S3, and deploy to production
- [App Setup Guide](./docs/app-setup.md) — local development walkthrough
