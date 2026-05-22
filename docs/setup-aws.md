# AWS Setup Guide — MailFlow

Complete step-by-step instructions for provisioning every AWS service MailFlow depends on.

---

## Prerequisites

- An AWS account with billing enabled
- AWS CLI installed locally: `brew install awscli` (Mac) or [see docs](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- A domain name you control (for SES sending identity)
- Node.js 20+ installed

---

## Table of Contents

1. [IAM — Create a Dedicated User](#1-iam--create-a-dedicated-user)
2. [RDS — PostgreSQL Database](#2-rds--postgresql-database)
3. [S3 — Asset Storage](#3-s3--asset-storage)
4. [SES — Email Sending](#4-ses--email-sending)
5. [SNS — SES Event Notifications](#5-sns--ses-event-notifications)
6. [Environment Variables Summary](#6-environment-variables-summary)
7. [DNS Records Reference](#7-dns-records-reference)
8. [Sending Limits & Sandbox Exit](#8-sending-limits--sandbox-exit)
9. [Optional — ECS Fargate Deployment](#9-optional--ecs-fargate-deployment)

---

## 1. IAM — Create a Dedicated User

Never use your root account for application credentials. Create a least-privilege IAM user.

### 1.1 Create the IAM user

1. Open the [IAM Console](https://console.aws.amazon.com/iam/)
2. Go to **Users** → **Create user**
3. Username: `mailflow-app`
4. Select **Programmatic access** (access key only — no console login needed)
5. Click **Next: Permissions**

### 1.2 Attach a policy

Create a custom inline policy. On the permissions step, choose **Attach policies directly** → **Create policy** → **JSON** tab, paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SESAccess",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendBulkTemplatedEmail",
        "ses:GetSendQuota",
        "ses:GetSendStatistics",
        "ses:GetIdentityVerificationAttributes",
        "ses:GetIdentityDkimAttributes",
        "ses:VerifyDomainIdentity",
        "ses:VerifyDomainDkim",
        "ses:ListIdentities",
        "ses:PutSuppressedDestination",
        "ses:DeleteSuppressedDestination",
        "ses:GetSuppressedDestination",
        "ses:ListSuppressedDestinations",
        "ses:PutConfigurationSet",
        "ses:CreateConfigurationSet",
        "ses:CreateConfigurationSetEventDestination"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SNSAccess",
      "Effect": "Allow",
      "Action": [
        "sns:CreateTopic",
        "sns:Subscribe",
        "sns:Publish",
        "sns:GetTopicAttributes",
        "sns:ListSubscriptionsByTopic"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::mailflow-assets/*"
    },
    {
      "Sid": "S3ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::mailflow-assets"
    }
  ]
}
```

Name the policy `mailflow-app-policy`. Save, then attach it to the `mailflow-app` user.

### 1.3 Generate access keys

1. Open the `mailflow-app` user → **Security credentials** tab
2. Click **Create access key** → choose **Application running outside AWS**
3. Download the CSV or copy both values now — the secret is shown only once

Set in your `.env`:
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

---

## 2. RDS — PostgreSQL Database

### 2.1 Create a security group

1. Open [VPC Console](https://console.aws.amazon.com/vpc/) → **Security Groups** → **Create security group**
2. Name: `mailflow-rds-sg`
3. VPC: your default VPC
4. **Inbound rules**: Add rule — Type: **PostgreSQL** (port 5432), Source: your app server IP or `0.0.0.0/0` (restrict this in production)
5. Save

### 2.2 Create the RDS instance

1. Open [RDS Console](https://console.aws.amazon.com/rds/) → **Create database**
2. Engine: **PostgreSQL**, Version: **16.x** (latest stable)
3. Template: **Free tier** (for development) or **Production** for live use
4. Settings:
   - DB instance identifier: `mailflow-db`
   - Master username: `mailflow`
   - Master password: generate a strong password, save it securely
5. DB instance class: `db.t3.micro` (dev) or `db.t3.small`+ (production)
6. Storage: 20 GB gp2, enable **Auto scaling**
7. Connectivity:
   - VPC: default
   - Public access: **Yes** (only if connecting from outside AWS; use No + bastion in production)
   - Security group: `mailflow-rds-sg`
8. Additional configuration:
   - Initial database name: `mailflow`
9. Click **Create database** (takes 3–5 minutes)

### 2.3 Get the connection string

Once the instance is **Available**, click on it and copy the **Endpoint** (looks like `mailflow-db.xxxx.us-east-1.rds.amazonaws.com`).

Set in your `.env`:
```
DATABASE_URL=postgresql://mailflow:YOUR_PASSWORD@mailflow-db.xxxx.us-east-1.rds.amazonaws.com:5432/mailflow
```

### 2.4 Run migrations

```bash
cd backend
npm run migrate
```

This creates all 8 tables automatically on first run.

---

## 3. S3 — Asset Storage

Used for storing uploaded logos from the Preference Centre configuration.

### 3.1 Create the bucket

1. Open [S3 Console](https://console.aws.amazon.com/s3/) → **Create bucket**
2. Bucket name: `mailflow-assets` (must be globally unique — append your account ID if taken, e.g. `mailflow-assets-123456`)
3. Region: `us-east-1` (same as everything else)
4. **Object Ownership**: ACLs enabled → Bucket owner preferred
5. **Block Public Access**: uncheck "Block all public access" for logo images to be publicly readable
6. Acknowledge the warning → **Create bucket**

### 3.2 Set a bucket policy for public read

Open the bucket → **Permissions** → **Bucket policy** → paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForLogos",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::mailflow-assets/logos/*"
    }
  ]
}
```

Replace `mailflow-assets` with your actual bucket name.

### 3.3 Configure CORS (for browser uploads)

Open the bucket → **Permissions** → **Cross-origin resource sharing (CORS)** → paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Set in your `.env`:
```
S3_BUCKET=mailflow-assets
```

---

## 4. SES — Email Sending

### 4.1 Verify your sending domain

1. Open [SES Console](https://console.aws.amazon.com/ses/) → **Configuration** → **Verified identities**
2. Click **Create identity** → choose **Domain**
3. Enter your domain (e.g. `acmecorp.com`)
4. Enable **DKIM** (Easy DKIM, 2048-bit) — SES generates 3 CNAME records for you
5. Click **Create identity**

SES displays the CNAME records. Add them to your DNS provider (see [Section 7](#7-dns-records-reference) for the full records reference).

### 4.2 Verify a from-address (for testing)

While in SES sandbox, you must also verify the recipient email for testing:

1. **Verified identities** → **Create identity** → **Email address**
2. Enter your test email → verify via the link in the email SES sends you

### 4.3 Configure a Configuration Set

A Configuration Set routes SES events (bounces, opens, clicks) to SNS.

1. SES Console → **Configuration** → **Configuration sets** → **Create set**
2. Name: `mailflow-events`
3. Click **Create set**

Set in your `.env` (the app sends all emails through this set):
```
SES_CONFIGURATION_SET=mailflow-events
```

> The configuration set is referenced in `emailService.js` when calling `SendEmailCommand`. Add `ConfigurationSetName: process.env.SES_CONFIGURATION_SET` to the command if you want full event tracking from the start.

### 4.4 Enable open and click tracking

1. Open the `mailflow-events` configuration set
2. **Sending events** tab → **Add destination**
3. Event types: check **Sends, Deliveries, Bounces, Complaints, Opens, Clicks**
4. Destination type: **Amazon SNS** (configured in the next section)
5. Come back and finish this step after creating the SNS topic in Section 5

---

## 5. SNS — SES Event Notifications

SNS receives events from SES and delivers them to your backend webhook endpoint.

### 5.1 Create the SNS topic

1. Open [SNS Console](https://console.aws.amazon.com/sns/) → **Topics** → **Create topic**
2. Type: **Standard**
3. Name: `mailflow-ses-events`
4. Click **Create topic**
5. Copy the **Topic ARN** (looks like `arn:aws:sns:us-east-1:123456789012:mailflow-ses-events`)

Set in your `.env`:
```
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:mailflow-ses-events
```

### 5.2 Subscribe your webhook endpoint

Your backend exposes `POST /api/webhooks/ses` to receive SNS notifications.

1. Inside the topic → **Create subscription**
2. Protocol: **HTTPS**
3. Endpoint: `https://yourapp.com/api/webhooks/ses`
   - For local development, use a tunnel tool like [ngrok](https://ngrok.com/): `ngrok http 3001`, then use the `https://....ngrok.io/api/webhooks/ses` URL
4. Click **Create subscription** — SNS sends a `SubscribeURL` confirmation request
5. Start your backend server — it automatically confirms the subscription when it receives the `SubscriptionConfirmation` request (handled in `webhooks.js`)
6. The subscription status changes to **Confirmed**

### 5.3 Wire SNS to SES

Go back to the SES configuration set (`mailflow-events`) → **Sending events** → **Add destination**:

- Event types: Sends, Deliveries, Bounces, Complaints, Opens, Clicks
- Destination: **Amazon SNS** → select `mailflow-ses-events`
- Save

### 5.4 (Optional) Local development with ngrok

```bash
# Install ngrok
brew install ngrok

# Start a tunnel to your local backend
ngrok http 3001

# Copy the HTTPS URL, e.g. https://abc123.ngrok.io
# Use https://abc123.ngrok.io/api/webhooks/ses as your SNS subscription endpoint
```

---

## 6. Environment Variables Summary

Copy `backend/.env.example` to `backend/.env` and fill in all values:

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://mailflow:PASSWORD@mailflow-db.xxxx.us-east-1.rds.amazonaws.com:5432/mailflow

# Auth
JWT_SECRET=generate-with-openssl-rand-base64-48

# AWS (all services)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# S3
S3_BUCKET=mailflow-assets

# SES
SES_CONFIGURATION_SET=mailflow-events
SES_SEND_RATE=14

# SNS
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:mailflow-ses-events

# URLs
APP_URL=https://yourapp.com
FRONTEND_URL=https://yourapp.com
```

Generate a secure JWT secret:
```bash
openssl rand -base64 48
```

---

## 7. DNS Records Reference

After verifying your domain in SES, add these records to your DNS provider.

### SPF record

Authorises Amazon SES to send email on behalf of your domain.

| Type | Name | Value |
|------|------|-------|
| TXT  | `@` (or your domain) | `v=spf1 include:amazonses.com ~all` |

If you already have an SPF record, add `include:amazonses.com` to it rather than creating a second TXT record.

### DKIM records (×3)

SES generates three unique CNAME records. They look like this (your values will differ):

| Type  | Name | Value |
|-------|------|-------|
| CNAME | `abc123._domainkey.yourdomain.com` | `abc123.dkim.amazonses.com` |
| CNAME | `def456._domainkey.yourdomain.com` | `def456.dkim.amazonses.com` |
| CNAME | `ghi789._domainkey.yourdomain.com` | `ghi789.dkim.amazonses.com` |

Copy the exact records from the SES console — do not use the placeholders above.

### DMARC record (recommended)

Prevents spoofing and gives you visibility into authentication failures.

| Type | Name | Value |
|------|------|-------|
| TXT  | `_dmarc.yourdomain.com` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; pct=100` |

- `p=quarantine` — suspicious email goes to spam (safe starting policy)
- `rua=` — where DMARC aggregate reports are emailed
- Upgrade to `p=reject` once you are confident all legitimate mail is passing DMARC

### DNS propagation

DNS changes can take up to 48 hours to propagate globally. SES polls for verification every few minutes. Check status in:

```
SES Console → Verified Identities → your domain → DKIM tab
```

All three DKIM CNAMEs must show **Verified** before sending will work.

---

## 8. Sending Limits & Sandbox Exit

### SES Sandbox

New SES accounts start in the **sandbox**:

- You can only send to verified email addresses
- Daily send quota: 200 emails
- Maximum send rate: 1 email/second

This is fine for testing. For production, request production access.

### Request production access

1. SES Console → **Account dashboard** → **Request production access**
2. Fill in the form:
   - Mail type: **Marketing**
   - Website URL: your platform URL
   - Use case: describe your platform and how you handle unsubscribes/bounces
   - Describe your opt-in process
3. AWS typically approves within 24 hours

After approval:
- Daily quota: starts at 50,000 emails/day (increases automatically as you send)
- Send rate: 14 emails/second (default; increases on request)

### Dedicated IPs (optional, for high volume)

If you send more than ~50,000 emails/month, request dedicated IPs:

1. SES Console → **Configuration** → **Dedicated IPs** → **Request dedicated IPs**
2. Cost: ~$24.95/month per IP
3. Assign the IP to a dedicated IP pool and reference the pool in your configuration set

---

## 9. Optional — ECS Fargate Deployment

For hosting the backend API in AWS without managing servers.

### 9.1 Build and push a Docker image

Create `backend/Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

Push to ECR:

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

# Create repository (once)
aws ecr create-repository --repository-name mailflow-backend --region us-east-1

# Build and push
docker build -t mailflow-backend ./backend
docker tag mailflow-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/mailflow-backend:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/mailflow-backend:latest
```

### 9.2 Create an ECS cluster

1. [ECS Console](https://console.aws.amazon.com/ecs/) → **Clusters** → **Create cluster**
2. Cluster name: `mailflow`
3. Infrastructure: **AWS Fargate** (serverless — no EC2 to manage)
4. Click **Create**

### 9.3 Create a Task Definition

1. **Task Definitions** → **Create new task definition**
2. Launch type: **Fargate**
3. Task role: create an IAM role with the same policy as `mailflow-app-policy`
4. Container:
   - Image URI: your ECR image URI
   - Port: 3001
   - Environment variables: add all keys from `.env` (or reference AWS Secrets Manager)
5. CPU: 0.5 vCPU, Memory: 1 GB (scale up as needed)

### 9.4 Store secrets in Secrets Manager (recommended)

Instead of hardcoding env vars in the task definition:

```bash
aws secretsmanager create-secret \
  --name mailflow/env \
  --secret-string file://backend/.env \
  --region us-east-1
```

Reference the secret in your task definition — Fargate injects the values as environment variables at container start.

### 9.5 Create a Service

1. Inside the cluster → **Create service**
2. Launch type: Fargate
3. Task definition: `mailflow-backend`
4. Service name: `mailflow-api`
5. Number of tasks: 1 (increase for HA)
6. Load balancer: attach an **Application Load Balancer** on port 443 (HTTPS)
7. Click **Create**

The ALB provides a stable DNS name. Point your domain at it via Route 53.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `MessageRejected: Email address is not verified` | Still in SES sandbox | Verify recipient, or request production access |
| `InvalidClientTokenId` | Wrong `AWS_ACCESS_KEY_ID` | Check `.env`, ensure no extra spaces |
| SNS subscription stays Pending | Backend not publicly reachable | Use ngrok for local dev |
| DKIM shows "Not started" after 24h | Wrong CNAME values or DNS propagation delay | Double-check CNAME names/values in DNS provider |
| `connect ECONNREFUSED` to RDS | Security group blocks connection | Add your IP to the inbound rules on `mailflow-rds-sg` |
| SES bounce rate warning | Sending to unverified or invalid addresses | Run list hygiene; check suppression list |
