# App Setup Guide — MailFlow

Steps to get the MailFlow application running locally after AWS infrastructure is provisioned.

---

## Prerequisites

- AWS setup complete (see [setup-aws.md](./setup-aws.md))
- `backend/.env` fully populated
- Node.js 20+ installed

---

## 1. Backend

```bash
cd backend
npm install
npm run migrate
npm run dev
```

Server runs on `http://localhost:3001`.

---

## 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:3000`.

---

## 3. Create your first account

There is no registration page in the UI. Create an account via the API:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword","name":"Your Name","company":"Your Company"}'
```

Then log in at `http://localhost:3000/login` with those credentials.

---

## 4. ngrok (for SNS webhook during local development)

SNS requires a public HTTPS endpoint to deliver events. Run ngrok in a separate terminal:

```bash
ngrok http 3001
```

Use the generated URL (e.g. `https://xxxx.ngrok-free.app/api/webhooks/ses`) as the SNS subscription endpoint.

> If you previously ran npm with `sudo` and hit permission errors:
> ```bash
> sudo chown -R $(whoami) ~/.npm
> ```

---

## 5. Verify DB tables

```bash
cd backend
node src/config/db-check.js
```

Prints schema, row counts, and sample rows for all tables.
