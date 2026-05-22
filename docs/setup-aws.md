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
9. [Production Deployment](#9-production-deployment)

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
      "Resource": "arn:aws:s3:::mailflow-assets-0173-6777-6352/*"
    },
    {
      "Sid": "S3ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::mailflow-assets-0173-6777-6352"
    }
  ]
}
```

Name the policy `mailflow-app-policy`. Save, then attach it to the `mailflow-app` user.

### 1.3 Generate access keys

1. Open the `mailflow-app` user → **Security credentials** tab
2. Click **Create access key** → choose **Application running outside AWS**
3. AWS may show a recommendation: *"Alternative recommended: Use IAM Roles Anywhere…"* — ignore this and click **Confirm** to proceed with a standard access key
4. Download the CSV or copy both values now — the secret is shown only once

Set in your `.env`:
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-2
```

---

## 2. RDS — PostgreSQL Database

### 2.1 Create a security group

1. Open [VPC Console](https://console.aws.amazon.com/vpc/) → **Security Groups** → **Create security group**
2. Name: `mailflow-rds-sg`
3. Description: `Allow PostgreSQL access for MailFlow app`
4. VPC: your default VPC
5. **Inbound rules**: Add rule — Type: **PostgreSQL** (port 5432), Source: your app server IP or `0.0.0.0/0` (restrict this in production)
6. Save

### 2.2 Create the RDS instance

1. Open [RDS Console](https://console.aws.amazon.com/rds/) → **Create database**
2. Engine: **PostgreSQL** — do **not** choose "Aurora (PostgreSQL Compatible)"; Aurora costs ~$500+/month and is unnecessary for this project
3. Version: **16.x** (latest stable)
4. Template: **Free tier** (for development) or **Production** for live use
5. Settings:
   - DB instance identifier: `mailflow-db`
   - Master username: `mailflow`
   - Master password: generate a strong password, save it securely
6. DB instance class: `db.t3.micro` (dev) or `db.t3.small`+ (production)
7. Storage: 20 GB gp2 — do **not** enable Provisioned IOPS (adds significant cost)
8. Connectivity:
   - VPC: default
   - Public access: **Yes** (only if connecting from outside AWS; use No + bastion in production)
   - Security group: `mailflow-rds-sg`
9. Additional configuration:
   - Initial database name: `mailflow`
10. Click **Create database** (takes 3–5 minutes)

### 2.3 Get the connection string

Once the instance is **Available**, click on it and copy the **Endpoint** (looks like `mailflow-db.xxxx.us-east-2.rds.amazonaws.com`).

Set in your `.env`:
```
DATABASE_URL=postgresql://mailflow:YOUR_PASSWORD@mailflow-db.xxxx.us-east-2.rds.amazonaws.com:5432/mailflow
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
2. Bucket name: `mailflow-assets-0173-6777-6352` (must be globally unique — append your account ID if taken, e.g. `mailflow-assets-0173-6777-6352-123456`)
3. Region: `us-east-2` (same as everything else)
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
      "Resource": "arn:aws:s3:::mailflow-assets-0173-6777-6352/logos/*"
    }
  ]
}
```

Replace `mailflow-assets-0173-6777-6352` with your actual bucket name.

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
S3_BUCKET=mailflow-assets-0173-6777-6352
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
5. Copy the **Topic ARN** (looks like `arn:aws:sns:us-east-2:123456789012:mailflow-ses-events`)

Set in your `.env`:
```
SNS_TOPIC_ARN=arn:aws:sns:us-east-2:123456789012:mailflow-ses-events
```

### 5.2 Subscribe your webhook endpoint

Your backend exposes `POST /api/webhooks/ses` to receive SNS notifications.

1. Inside the topic → **Create subscription**
2. Protocol: **HTTPS**
3. Endpoint: `https://yourapp.com/api/webhooks/ses`
   - For local development, use ngrok: `ngrok http 3001`, then use `https://<your-ngrok-id>.ngrok-free.app/api/webhooks/ses`
4. Click **Create subscription** — status will show **Pending confirmation**
5. **Before this step**: make sure `pino-pretty` is installed (`npm install pino-pretty --save-dev`) and start the backend (`npm run dev`)
   - If you previously ran any npm command with `sudo` and get a permission error, fix it first: `sudo chown -R $(whoami) ~/.npm`
6. Once the backend is running, SNS automatically retries the confirmation — the backend logs `SNS subscription confirmation received` and responds 200
7. The subscription status changes to **Confirmed**

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
DATABASE_URL=postgresql://mailflow:PASSWORD@mailflow-db.xxxx.us-east-2.rds.amazonaws.com:5432/mailflow

# Auth
JWT_SECRET=generate-with-openssl-rand-base64-48

# AWS (all services)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-2

# S3
S3_BUCKET=mailflow-assets-0173-6777-6352

# SES
SES_CONFIGURATION_SET=mailflow-events
SES_SEND_RATE=14

# SNS
SNS_TOPIC_ARN=arn:aws:sns:us-east-2:123456789012:mailflow-ses-events

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

## 9. Production Deployment

This section covers deploying both the backend API and the frontend to AWS. The final architecture looks like this:

```
Users
  │
  ▼
CloudFront (CDN)
  ├── /api/*  ──────────────────▶  ALB  ──▶  ECS Fargate (backend)
  │                                               │
  └── /*  (static files) ──▶  S3 bucket          ├── RDS PostgreSQL
                              (frontend build)    ├── SES / SNS
                                                  └── S3 (logos)
```

**Prerequisites for this section**
- Docker installed locally
- AWS CLI configured (`aws configure`)
- Sections 1–8 complete (IAM user, RDS, S3, SES, SNS all provisioned)
- A registered domain (can be in Route 53 or any registrar)

---

### 9.1 Request a TLS certificate (ACM)

All production traffic must run over HTTPS. AWS Certificate Manager (ACM) issues free certificates.

1. Open [ACM Console](https://console.aws.amazon.com/acm/) — **make sure the region is us-east-1** if you plan to use CloudFront (CloudFront requires certificates in us-east-1 regardless of your app region)
2. Click **Request** → **Request a public certificate**
3. Add domain names:
   - `yourdomain.com`
   - `api.yourdomain.com` (if you want a separate API subdomain)
   - Or use a wildcard: `*.yourdomain.com`
4. Validation method: **DNS validation** (recommended)
5. Click **Request**
6. Expand the certificate and click **Create records in Route 53** (if your domain is in Route 53) — or manually add the CNAME records shown to your DNS provider
7. Wait for status to change to **Issued** (usually 2–5 minutes after DNS propagates)

---

### 9.2 Deploy the backend — ECS Fargate

#### 9.2.1 Create the Dockerfile

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

#### 9.2.2 Create an ECR repository and push

Replace `123456789012` with your actual AWS account ID:

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-2.amazonaws.com

# Create repository (run once)
aws ecr create-repository --repository-name mailflow-backend --region us-east-2

# Build and push
docker build -t mailflow-backend ./backend
docker tag mailflow-backend:latest \
  123456789012.dkr.ecr.us-east-2.amazonaws.com/mailflow-backend:latest
docker push \
  123456789012.dkr.ecr.us-east-2.amazonaws.com/mailflow-backend:latest
```

#### 9.2.3 Store secrets in AWS Secrets Manager

Never put secrets in your task definition or source code. Store them once:

```bash
aws secretsmanager create-secret \
  --name mailflow/production \
  --region us-east-2 \
  --secret-string '{
    "DATABASE_URL": "postgresql://...",
    "JWT_SECRET": "...",
    "AWS_ACCESS_KEY_ID": "AKIA...",
    "AWS_SECRET_ACCESS_KEY": "...",
    "AWS_REGION": "us-east-2",
    "S3_BUCKET": "mailflow-assets-0173-6777-6352",
    "SES_CONFIGURATION_SET": "mailflow-events",
    "SNS_TOPIC_ARN": "arn:aws:sns:us-east-2:123456789012:mailflow-ses-events",
    "APP_URL": "https://yourdomain.com",
    "FRONTEND_URL": "https://yourdomain.com",
    "SES_SEND_RATE": "14"
  }'
```

To update a secret later:
```bash
aws secretsmanager update-secret \
  --secret-id mailflow/production \
  --region us-east-2 \
  --secret-string '{"KEY": "new-value", ...}'
```

#### 9.2.4 Create an ECS Task Execution IAM Role

This role lets ECS pull secrets from Secrets Manager and images from ECR.

1. [IAM Console](https://console.aws.amazon.com/iam/) → **Roles** → **Create role**
2. Trusted entity: **AWS service** → **Elastic Container Service Task**
3. Attach policies:
   - `AmazonECSTaskExecutionRolePolicy` (managed — allows ECR pull + CloudWatch logs)
   - Add an inline policy to allow Secrets Manager access:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Action": ["secretsmanager:GetSecretValue"],
         "Resource": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production*"
       }]
     }
     ```
4. Role name: `mailflow-ecs-execution-role`

#### 9.2.5 Create an Application Load Balancer

1. [EC2 Console](https://console.aws.amazon.com/ec2/) → **Load Balancers** → **Create load balancer**
2. Type: **Application Load Balancer**
3. Name: `mailflow-alb`
4. Scheme: **Internet-facing**
5. Listeners:
   - Add **HTTPS (443)** → forward to a new target group `mailflow-api-tg` (port 3001, HTTP, health check path `/health`)
   - Add **HTTP (80)** → redirect to HTTPS 443
6. Security group: create `mailflow-alb-sg` with inbound rules allowing 443 and 80 from `0.0.0.0/0`
7. SSL certificate: select the ACM certificate from step 9.1
8. Click **Create**

Copy the **ALB DNS name** — you will need it for Route 53.

#### 9.2.6 Create an ECS cluster and service

**Cluster:**
1. [ECS Console](https://console.aws.amazon.com/ecs/) → **Clusters** → **Create cluster**
2. Name: `mailflow`, Infrastructure: **AWS Fargate** → **Create**

**Task Definition:**
1. **Task Definitions** → **Create new task definition with JSON** → paste:
```json
{
  "family": "mailflow-backend",
  "executionRoleArn": "arn:aws:iam::123456789012:role/mailflow-ecs-execution-role",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "mailflow-backend",
    "image": "123456789012.dkr.ecr.us-east-2.amazonaws.com/mailflow-backend:latest",
    "portMappings": [{"containerPort": 3001, "protocol": "tcp"}],
    "secrets": [
      {"name": "DATABASE_URL",      "valueFrom": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:DATABASE_URL::"},
      {"name": "JWT_SECRET",        "valueFrom": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:JWT_SECRET::"},
      {"name": "AWS_ACCESS_KEY_ID", "valueFrom": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:AWS_ACCESS_KEY_ID::"},
      {"name": "AWS_SECRET_ACCESS_KEY","valueFrom":"arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:AWS_SECRET_ACCESS_KEY::"},
      {"name": "AWS_REGION",        "valueFrom": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:AWS_REGION::"},
      {"name": "S3_BUCKET",         "valueFrom": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:S3_BUCKET::"},
      {"name": "SES_CONFIGURATION_SET","valueFrom":"arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:SES_CONFIGURATION_SET::"},
      {"name": "SNS_TOPIC_ARN",     "valueFrom": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:SNS_TOPIC_ARN::"},
      {"name": "APP_URL",           "valueFrom": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:APP_URL::"},
      {"name": "FRONTEND_URL",      "valueFrom": "arn:aws:secretsmanager:us-east-2:123456789012:secret:mailflow/production:FRONTEND_URL::"}
    ],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT",     "value": "3001"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/mailflow-backend",
        "awslogs-region": "us-east-2",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```
> Replace all `123456789012` with your AWS account ID.

Create a CloudWatch log group first:
```bash
aws logs create-log-group --log-group-name /ecs/mailflow-backend --region us-east-2
```

**Service:**
1. Inside the `mailflow` cluster → **Create service**
2. Launch type: **Fargate**
3. Task definition: `mailflow-backend` (latest)
4. Service name: `mailflow-api`
5. Desired tasks: `1` (use `2` for high availability)
6. Networking: select your default VPC and subnets; security group must allow inbound from `mailflow-alb-sg` on port 3001
7. Load balancer: **Application Load Balancer** → select `mailflow-alb` → target group `mailflow-api-tg`
8. Click **Create service**

The service will take ~2 minutes to reach a running state. Check the **Tasks** tab — the task health should show `RUNNING`.

---

### 9.3 Deploy the frontend — S3 + CloudFront

The React app is a static build. Host it on S3 and serve it globally via CloudFront.

#### 9.3.1 Build the frontend

Update your production API URL before building. In `frontend/.env.production` (create this file):

```env
VITE_API_URL=https://yourdomain.com
```

Then build:

```bash
cd frontend
npm run build
# Output goes to frontend/dist/
```

#### 9.3.2 Create an S3 bucket for the frontend

This bucket is private — CloudFront fetches from it, not public users directly.

```bash
aws s3 mb s3://mailflow-frontend-prod --region us-east-2
```

Upload the build:

```bash
aws s3 sync frontend/dist/ s3://mailflow-frontend-prod/ --delete
```

#### 9.3.3 Create a CloudFront distribution

1. Open [CloudFront Console](https://console.aws.amazon.com/cloudfront/) → **Create distribution**
2. **Origin domain**: select your `mailflow-frontend-prod` S3 bucket
3. **Origin access**: **Origin access control settings (recommended)** → create a new OAC → CloudFront will show you a bucket policy to apply to S3
4. **Viewer protocol policy**: Redirect HTTP to HTTPS
5. **Default root object**: `index.html`
6. **Custom error responses** — add two rules (required for React Router client-side routing):
   - Error code `403` → Response page `/index.html` → HTTP response code `200`
   - Error code `404` → Response page `/index.html` → HTTP response code `200`
7. **Alternate domain names (CNAMEs)**: add `yourdomain.com` (and `www.yourdomain.com` if needed)
8. **Custom SSL certificate**: select the ACM certificate from step 9.1 (must be in us-east-1)
9. Click **Create distribution** (takes 5–10 minutes to deploy globally)

Apply the S3 bucket policy CloudFront shows you — it allows only CloudFront to read the bucket:
```bash
# Paste the policy shown in the CloudFront console into a file, then apply:
aws s3api put-bucket-policy \
  --bucket mailflow-frontend-prod \
  --policy file://cloudfront-bucket-policy.json
```

Copy the **CloudFront domain name** (e.g. `d1abc.cloudfront.net`) for the next step.

#### 9.3.4 Route /api/* to the ALB (single domain setup)

If you want both the frontend and API on the same domain (`yourdomain.com`), add a second origin to your CloudFront distribution:

1. CloudFront distribution → **Origins** → **Create origin**
   - Origin domain: your ALB DNS name (`mailflow-alb-xxxxxxxx.us-east-2.elb.amazonaws.com`)
   - Protocol: HTTPS only
   - Origin name: `mailflow-api`
2. **Behaviors** → **Create behavior**
   - Path pattern: `/api/*`
   - Origin: `mailflow-api`
   - Viewer protocol: HTTPS only
   - Cache policy: **CachingDisabled** (API responses must not be cached)
   - Origin request policy: **AllViewer** (forward all headers to the backend)

Now all requests to `yourdomain.com/api/*` go to ECS, and everything else serves the React app from S3.

---

### 9.4 Configure DNS (Route 53)

If your domain is registered outside Route 53, create a hosted zone first:

```bash
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)
```

Copy the 4 nameservers from the hosted zone and update them at your domain registrar.

**Add DNS records:**

1. Open [Route 53 Console](https://console.aws.amazon.com/route53/) → **Hosted zones** → your domain
2. Click **Create record**:

| Name | Type | Route traffic to |
|------|------|-----------------|
| `yourdomain.com` | A (Alias) | CloudFront distribution |
| `www.yourdomain.com` | A (Alias) | CloudFront distribution |

For Alias records, choose:
- Route traffic to: **Alias to CloudFront distribution**
- Select your distribution from the dropdown

---

### 9.5 Run database migrations on production

Connect to your RDS instance from your local machine (ensure your IP is in the RDS security group):

```bash
cd backend

# Point at production DB temporarily
DATABASE_URL="postgresql://mailflow:PASSWORD@mailflow-db.xxxx.us-east-2.rds.amazonaws.com:5432/mailflow" \
  npm run migrate
```

Or SSH into a bastion host if RDS is not publicly accessible.

---

### 9.6 Update the SNS webhook subscription

Now that your app is deployed, update your SNS subscription to point to the production URL:

1. SNS Console → `mailflow-ses-events` topic → **Subscriptions**
2. Delete the old ngrok subscription (if any)
3. **Create subscription** → Protocol: HTTPS → Endpoint: `https://yourdomain.com/api/webhooks/ses`
4. The ECS service will confirm the subscription automatically within a few seconds

---

### 9.7 Deploying updates

After every code change, rebuild and push a new image to ECR, then force a new ECS deployment:

```bash
# Build and push new image
docker build -t mailflow-backend ./backend
docker tag mailflow-backend:latest \
  123456789012.dkr.ecr.us-east-2.amazonaws.com/mailflow-backend:latest
docker push \
  123456789012.dkr.ecr.us-east-2.amazonaws.com/mailflow-backend:latest

# Force ECS to pull the new image
aws ecs update-service \
  --cluster mailflow \
  --service mailflow-api \
  --force-new-deployment \
  --region us-east-2
```

For frontend updates:

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://mailflow-frontend-prod/ --delete

# Invalidate CloudFront cache so users get the new files immediately
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

---

### 9.8 Production checklist

Before going live, verify each item:

- [ ] ACM certificate status is **Issued**
- [ ] CloudFront distribution is **Deployed** (not In Progress)
- [ ] `https://yourdomain.com` loads the React app
- [ ] `https://yourdomain.com/api/health` returns `{"status":"ok"}`
- [ ] Login works and JWT is returned
- [ ] Send a test campaign — check SES **Sending statistics** for the delivery
- [ ] SNS subscription is **Confirmed** (not Pending)
- [ ] A test bounce/complaint updates the contact status in the DB
- [ ] RDS security group does **not** allow `0.0.0.0/0` in production (restrict to ECS security group only)
- [ ] SES production access requested (not in sandbox)
- [ ] DKIM, SPF, DMARC DNS records all verified in SES console

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
