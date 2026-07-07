# Tencent Cloud Go-Live Runbook

This runbook migrates the current Vercel + Supabase deployment to the Tencent Cloud server shown in the screenshot:

```text
OS: OpenCloudOS-oTom
CPU/RAM/Disk: 4 cores / 4 GB / 40 GB
Public IPv4: 82.157.190.68
```

Recommended first migration step: move frontend and backend runtime to Tencent Cloud, while keeping Supabase as database/auth/storage. After the app is stable on Tencent Cloud, migrate Supabase responsibilities to Tencent Cloud PostgreSQL/COS/Auth in separate phases.

## 1. Information to Collect

### Tencent Cloud

- Server public IP: `82.157.190.68`
- Login method: SSH password or SSH private key
- SSH user: usually `root` or the user created during server setup
- Security group/firewall rules
- Domain name, if available
- ICP/filing status if the service is intended for mainland China public access

### From Vercel

Backend project environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
EXTERNAL_API_SECRET
GEMINI_API_KEY or GOOGLE_API_KEY
QWEN_API_KEY
DASHSCOPE_API_KEY
API_KEY_GEMINI
API_KEY_OPENAI
API_KEY_QWEN
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
SMTP_FROM_EMAIL
```

Frontend project environment variables:

```text
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY
REACT_APP_API_URL
```

Current frontend code mostly uses `window.location.origin` in production, so `REACT_APP_API_URL` is less important after same-origin Nginx deployment. Still collect it for comparison.

### From Supabase

Project settings:

```text
Project URL
Anon public key
Service role key
JWT secret, only if later replacing Supabase token validation
```

Auth URL settings:

```text
Site URL
Redirect URLs / Additional Redirect URLs
Email template links, if customized
```

Storage:

```text
Buckets: file_sync and any other bucket currently used
Public/private setting
RLS policies
```

Database backup:

```text
SQL schema backup
Data backup
Storage file export plan
```

## 2. Tencent Cloud Security Group

Open only what is needed:

| Port | Source | Purpose |
| --- | --- | --- |
| 22 | Your office/VPN IP only | SSH |
| 80 | 0.0.0.0/0 | HTTP, certificate challenge, redirect |
| 443 | 0.0.0.0/0 | HTTPS |

Do not expose backend port `3001` publicly. Nginx should proxy `/api` to `127.0.0.1:3001`.

## 3. Server Bootstrap

SSH into the server:

```bash
ssh root@82.157.190.68
```

Update packages:

```bash
dnf update -y
```

Install common tools:

```bash
dnf install -y git nginx firewalld
systemctl enable --now firewalld
systemctl enable --now nginx
```

Install Node.js 20 LTS. If the Tencent image package repository has Node 20:

```bash
dnf module list nodejs
dnf module enable nodejs:20 -y
dnf install -y nodejs npm
```

If Node 20 is not available from the OS repository, use NodeSource or nvm according to your company policy.

Install PM2:

```bash
npm install -g pm2
pm2 startup systemd
```

## 4. Upload Code

Recommended path:

```bash
mkdir -p /opt/sd-project
cd /opt/sd-project
git clone <your-repo-url> .
```

If the repository is private, configure SSH deploy key or use a temporary GitHub/GitLab token. Do not paste long-lived personal credentials into shell history.

## 5. Backend Environment

Create backend env file:

```bash
cd /opt/sd-project/supplier-platform-backend
cp .env.tencent.example .env
vi .env
```

Minimum required while still using Supabase:

```text
NODE_ENV=production
PORT=3001
SUPABASE_URL=<from Supabase>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase>
EXTERNAL_API_SECRET=<same as Vercel if used>
GEMINI_API_KEY=<if used>
GOOGLE_API_KEY=<if used>
QWEN_API_KEY=<if used>
DASHSCOPE_API_KEY=<if used>
SMTP_HOST=<if email is used>
SMTP_PORT=<if email is used>
SMTP_USER=<if email is used>
SMTP_PASS=<if email is used>
SMTP_FROM=<if email is used>
SMTP_FROM_EMAIL=<if email is used>
```

Install and start backend:

```bash
npm ci
pm2 start server.js --name sd-backend
pm2 save
```

Test locally on the server:

```bash
curl http://127.0.0.1:3001/api/categories
```

## 6. Frontend Build

Create frontend env:

```bash
cd /opt/sd-project/supplier-platform-frontend
cat > .env.production <<'EOF'
REACT_APP_SUPABASE_URL=<from Supabase>
REACT_APP_SUPABASE_ANON_KEY=<from Supabase>
REACT_APP_API_URL=https://your-domain.example.com
EOF
```

If no domain is ready yet, temporarily use:

```text
REACT_APP_API_URL=http://82.157.190.68
```

Build:

```bash
npm ci
npm run build
```

Deploy static files:

```bash
mkdir -p /var/www/sd-portal
rsync -a --delete build/ /var/www/sd-portal/
```

## 7. Nginx Same-Origin Config

Create:

```bash
vi /etc/nginx/conf.d/sd-portal.conf
```

Use this config for IP-only HTTP first:

```nginx
server {
    listen 80;
    server_name 82.157.190.68;

    root /var/www/sd-portal;
    index index.html;

    client_max_body_size 100m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Validate and reload:

```bash
nginx -t
systemctl reload nginx
```

Open:

```text
http://82.157.190.68
```

## 8. Domain and HTTPS

Strongly recommended before production:

1. Point a domain, for example `sd-portal.example.com`, to `82.157.190.68`.
2. Update Nginx `server_name`.
3. Install an SSL certificate.
4. Redirect HTTP to HTTPS.
5. Rebuild frontend with:

```text
REACT_APP_API_URL=https://sd-portal.example.com
```

Also update Supabase Auth:

```text
Site URL: https://sd-portal.example.com
Redirect URLs:
https://sd-portal.example.com/*
https://sd-portal.example.com/update-password
```

## 9. Frontend URL Check

Most frontend modules use:

```js
window.location.origin
```

`supplier-platform-frontend/src/services/EmailService.js` has also been adjusted to same-origin URLs. Before final cutover, verify that no active production code still contains hardcoded Vercel URLs:

```text
supplier-interaction-platform-backend.vercel.app
supplier-interaction-platform.vercel.app/login
```

## 10. Smoke Test

Run in this order:

1. Open `http://82.157.190.68`.
2. Log in.
3. Load dashboard.
4. Fetch notices.
5. Create a test notice.
6. Upload/download a test file.
7. Send a test email if SMTP is configured.
8. Test password reset/update flow.
9. Confirm browser Network tab calls `/api/...` on the Tencent domain/IP, not Vercel.
10. Check PM2 logs:

```bash
pm2 logs sd-backend
```

## 11. Rollback Plan

Keep Vercel running until Tencent Cloud passes smoke tests.

Rollback is simple:

- If using DNS, point DNS back to Vercel.
- If users still access Vercel URL directly, do not delete Vercel project yet.
- Keep Supabase untouched during phase 1.

## 12. Later Migration Phases

After Tencent Cloud runtime is stable:

1. Move file storage from Supabase Storage to Tencent COS.
2. Move database from Supabase PostgreSQL to Tencent PostgreSQL/TDSQL-C.
3. Replace Supabase Auth with backend JWT auth if required.
4. Remove Vercel configuration and Supabase client usage only after all direct calls are replaced.
