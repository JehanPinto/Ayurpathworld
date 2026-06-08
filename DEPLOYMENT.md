# Deployment Documentation — AyurvedicDoc

## Overview

This document covers the AWS Elastic Beanstalk development environment setup, CI/CD pipeline configuration, and deployment workflow for the `dev-aws-hosting` branch.

---

## Branch

| Branch | Purpose |
|---|---|
| `dev-aws-hosting` | AWS deployment and testing — all deployment work happens here |

All deployment configuration and testing must be done on `dev-aws-hosting`. Changes can be merged back into `development` after validation.

---

## AWS Elastic Beanstalk Environment

| Setting | Value |
|---|---|
| Environment name | `development` |
| Application name | `ayurvedicdoc` |
| Region | `ap-southeast-1` (Singapore) |
| Platform | Node.js 20 on Amazon Linux 2023 |
| Instance type | t3.micro (free tier) |
| URL | http://development.eba-mpmbwi9i.ap-southeast-1.elasticbeanstalk.com |

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL — `ep-fancy-poetry` testing branch |
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `SESSION_SECRET` | JWT signing secret |
| `CLOUDINARY_NAME/KEY/SECRET` | Cloudinary file upload credentials |
| `EMAIL_USER / EMAIL_PASS` | Email credentials |
| `RESEND_API_KEY` | Resend email API key |

---

## CI/CD Pipeline — GitHub Actions

### Workflow file
`.github/workflows/deploy-dev.yml`

### Triggers
The workflow runs automatically when:
1. **A commit is pushed** to `dev-aws-hosting`
2. **A pull request is closed** (merged) targeting `dev-aws-hosting`
3. **Manually triggered** via GitHub Actions → Deploy to EB Development → Run workflow

### What the workflow does
1. Checks out the code
2. Sets up Node.js 20
3. Runs `npm ci` to install dependencies
4. Runs `npm run build` to compile TypeScript (frontend + backend)
5. Force-adds the `dist/` folder (compiled output, normally gitignored)
6. Configures AWS credentials from GitHub Secrets
7. Installs the EB CLI
8. Runs `eb deploy development --staged` to deploy to the EB environment

### Required GitHub Secrets
Go to **Settings → Secrets and variables → Actions** to manage:

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |

### Viewing workflow runs
Go to **GitHub → Actions → Deploy to EB Development** to see all runs, logs, and status.

---

## CloudWatch Logging

Configured via `.ebextensions/cloudwatch-logs.config`.

| Log Group | Contents |
|---|---|
| `/aws/elasticbeanstalk/development/var/log/web.stdout.log` | Application logs |
| `/aws/elasticbeanstalk/development/var/log/nginx/access.log` | HTTP access logs |
| `/aws/elasticbeanstalk/development/var/log/nginx/error.log` | Nginx error logs |
| `/aws/elasticbeanstalk/development/var/log/eb-engine.log` | EB deployment logs |
| `/aws/elasticbeanstalk/development/var/log/eb-hooks.log` | EB hook logs |

- Retention: 7 days
- Health log streaming: enabled
- Enhanced health monitoring: enabled

---

## Creating the Environment (from scratch)

If the environment has been terminated, recreate it with:

```bash
# 1. Load environment variables
set -a && source .env && set +a

# 2. Create the environment
eb create development --envvars "DATABASE_URL=$DATABASE_URL,SESSION_SECRET=$SESSION_SECRET,NODE_ENV=production,CLOUDINARY_NAME=$CLOUDINARY_NAME,CLOUDINARY_KEY=$CLOUDINARY_KEY,CLOUDINARY_SECRET=$CLOUDINARY_SECRET,EMAIL_USER=$EMAIL_USER,EMAIL_PASS=$EMAIL_PASS,RESEND_API_KEY=$RESEND_API_KEY,PORT=8080"

# 3. Wait ~5-7 minutes, then check status
eb status development
```

## Terminating the Environment

```bash
eb terminate development --force
```

> Terminate when not actively testing to avoid unnecessary usage on the company AWS account.

---

## Known Issues and Fixes Applied

### 1. Auth cookie not working over HTTP
**Problem:** The app sets auth cookies with `secure: true` (HTTPS only) because `NODE_ENV=production`. The EB environment runs on HTTP, so browsers reject the cookie after login, redirecting users back to the login page.

**Fix:** Updated `client/src/lib/queryClient.ts` to read the JWT token from `localStorage` and send it as an `Authorization: Bearer <token>` header on all API requests. The backend already supported Bearer token auth as a fallback.

### 2. Stuck EC2 instances during in-place config updates
**Problem:** When EB tries to run configuration commands on a running instance (e.g. installing CloudWatch agent via `eb logs` command), the instance hangs and becomes unresponsive for ~19 minutes.

**Fix:** All configuration is handled declaratively via `.ebextensions` files, which apply during deployment — not as live updates to a running instance. If an instance gets stuck, terminate it directly via AWS CLI (`aws ec2 terminate-instances --instance-ids <id>`) and EB will auto-provision a fresh one.

### 3. Raw fetch() calls missing Bearer token
**Problem:** Several admin and doctor pages used raw `fetch()` directly instead of the app's `apiRequest()` wrapper, so they never sent the auth token and got 401 errors.

**Fix:** Replaced raw `fetch()` with `apiRequest()` in `admin/doctors.tsx`, `admin/payments.tsx`, `admin/refunds.tsx`, and `doctor/earnings.tsx`.

---

## DEV-171 Validation Results

End-to-end test performed on **2026-06-04**:

| Test | Result |
|---|---|
| Push to `dev-aws-hosting` triggers workflow | Passed |
| Workflow builds project successfully | Passed — completed in 1m 36s |
| Workflow deploys to EB automatically | Passed |
| Site accessible after automated deploy | Passed — HTTP 200 |
| EB environment health after deploy | Green / Ready |
| Admin login and dashboard |  Working |
| Doctor login and dashboard |  Working |
| Patient login and dashboard |  Working |
| API endpoints returning data | Working |
| CloudWatch logs streaming |  Active |
