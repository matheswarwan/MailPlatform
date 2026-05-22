# Deployment Guide — MailFlow

Recommended: single **EC2 instance** (t3.small, ~$17/month) running both frontend and backend behind Nginx with SSL.

Architecture:
```
Internet → Route 53 → EC2 (Nginx)
                         ├── /          → frontend static files (dist/)
                         └── /api/*     → backend (Node.js on port 3001, managed by PM2)
```

---

## Prerequisites

- EC2 instance launched (see step 1)
- Domain name with DNS pointing to EC2's public IP
- All AWS services provisioned (see `docs/setup-aws.md`)

---

## 1. Launch EC2 Instance

1. [EC2 Console](https://console.aws.amazon.com/ec2/) → **Launch instance**
2. Name: `mailflow-app`
3. AMI: **Ubuntu Server 24.04 LTS (64-bit)**
4. Instance type: **t3.small** (2 vCPU, 2 GB RAM) — t3.micro works for very low volume
5. Key pair: create or select an existing one — download the `.pem` file
6. Network settings:
   - Allow **SSH** (port 22) from your IP
   - Allow **HTTP** (port 80) from anywhere
   - Allow **HTTPS** (port 443) from anywhere
7. Storage: **20 GB gp3**
8. Click **Launch instance**

Once running, note the **Public IPv4 address**.

Point your domain's A record at this IP (e.g. `app.yourdomain.com → 1.2.3.4`).

---

## 2. Initial Server Setup

SSH into the instance:
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

### Install Node.js 22
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v22.x
```

### Install PM2 (process manager) and Nginx
```bash
sudo npm install -g pm2
sudo apt-get install -y nginx
```

### Install Git and clone the repo
```bash
sudo apt-get install -y git
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /home/ubuntu/mailflow
cd /home/ubuntu/mailflow
```

---

## 3. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Fill in all values — use your production RDS endpoint, real AWS credentials, and a fresh JWT secret:

```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://mailflow:PASSWORD@mailflow-db.xxxx.us-east-2.rds.amazonaws.com:5432/mailflow
JWT_SECRET=<run: openssl rand -base64 48>
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-2
S3_BUCKET=mailflow-assets-0173-6777-6352
SES_CONFIGURATION_SET=mailflow-events
SES_SEND_RATE=14
SNS_TOPIC_ARN=arn:aws:sns:us-east-2:...
APP_URL=https://app.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```

---

## 4. Install Dependencies and Run Migrations

```bash
cd /home/ubuntu/mailflow/backend
npm ci --omit=dev
npm run migrate
```

---

## 5. Build the Frontend

```bash
cd /home/ubuntu/mailflow/frontend
npm ci
npm run build
# Output is in frontend/dist/
```

---

## 6. Start the Backend with PM2

```bash
cd /home/ubuntu/mailflow/backend
pm2 start src/index.js --name mailflow-api
pm2 save
pm2 startup   # follow the printed command to auto-start on reboot
```

Check it's running:
```bash
pm2 status
pm2 logs mailflow-api --lines 30
```

---

## 7. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/mailflow
```

Paste (replace `app.yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    # Frontend — serve built React app
    root /home/ubuntu/mailflow/frontend/dist;
    index index.html;

    # API — proxy to Node.js backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        client_max_body_size 50M;
    }

    # React Router — serve index.html for all non-API routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/mailflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

At this point your app should be accessible at `http://app.yourdomain.com`.

---

## 8. Enable HTTPS with Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com
```

Certbot automatically updates the Nginx config to redirect HTTP → HTTPS. It sets up auto-renewal via a systemd timer — no action needed.

Verify auto-renewal works:
```bash
sudo certbot renew --dry-run
```

---

## 9. Update SNS Webhook Endpoint

Now that you have a real HTTPS URL, update the SNS subscription:

1. SNS Console → **Topics** → `mailflow-ses-events` → **Subscriptions**
2. Delete the old ngrok subscription
3. Create new subscription: Protocol **HTTPS**, Endpoint: `https://app.yourdomain.com/api/webhooks/ses`
4. The backend auto-confirms it (watch `pm2 logs mailflow-api`)

---

## Deploying Updates

For every code change after initial deployment:

```bash
cd /home/ubuntu/mailflow

# Pull latest code
git pull origin main

# Backend changes
cd backend
npm ci --omit=dev
pm2 restart mailflow-api

# Frontend changes
cd ../frontend
npm ci
npm run build

# If DB schema changed
cd ../backend
npm run migrate
```

---

## Monitoring

```bash
pm2 status               # process health
pm2 logs mailflow-api    # live logs
pm2 monit                # CPU/memory dashboard

sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 502 Bad Gateway | Backend not running — check `pm2 status` and `pm2 logs mailflow-api` |
| White screen / 404 on refresh | Nginx `try_files` missing — ensure the location / block is correct |
| API calls fail with CORS | `FRONTEND_URL` in `.env` doesn't match the actual origin |
| Can't connect to RDS | EC2's security group not in the `mailflow-rds-sg` inbound rules — add EC2's private IP |
| SSL cert fails | Domain DNS not yet pointing to EC2 IP — DNS must propagate first |
| SNS not confirming | Backend not reachable at the HTTPS URL yet — check Nginx and PM2 are running |
