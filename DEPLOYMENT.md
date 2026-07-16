# Production Deployment

> [!WARNING]
> This project is deprecated and receives no maintenance or security updates. These instructions are retained for people evaluating or forking the code, not as a claim that the original deployment is still online. Audit the application and update dependencies before exposing a fork to the internet.

## Prerequisites

- A Linux VPS with current security updates
- Docker Engine with the Compose plugin
- A DNS record such as `analytics.example.com` pointing to the VPS
- Caddy or Nginx terminating HTTPS
- `git`, `curl`, and `openssl`

## Configure

```bash
git clone https://github.com/1337lean/bufferdash.git
cd bufferdash
cp .env.example .env
chmod 600 .env
```

Generate separate database, session, tracking, and optional ingestion secrets. Never reuse a secret and never commit `.env`.

Generate a URL-safe database password and two independent application secrets:

```bash
openssl rand -hex 32
openssl rand -base64 48
openssl rand -base64 48
```

Use a hexadecimal database password so it can safely appear in `DATABASE_URL`. Keep the bcrypt admin hash single-quoted in `.env` so its `$` characters remain literal.

Recommended values:

```env
LOCAL_ONLY=false
APP_URL=https://analytics.example.com
BIND_ADDRESS=127.0.0.1
ANONYMIZE_IP=true
TRUST_PROXY=true
ENFORCE_TRACKING_ORIGIN=true
FILTER_BOTS=false
SERVER_METRICS_SOURCE=host
ENABLE_HTTP_INGESTION=true
ENABLE_HOST_INGESTION=true
DATA_RETENTION_DAYS=90
```

Keep `ADMIN_PASSWORD` empty. `ADMIN_PASSWORD_HASH` must be a complete bcrypt hash with a work factor of at least 12. The database password must match exactly in `POSTGRES_PASSWORD` and `DATABASE_URL`.

Before touching containers, run the production preflight:

```bash
scripts/production-check.sh .env
```

It checks secret strength and separation, the admin hash, HTTPS and loopback settings, matching database credentials, privacy and origin protections, migration completeness, file permissions, a clean Git tree, and the resolved Compose configuration.

## Start and verify

```bash
scripts/deploy-production.sh .env
docker compose ps
curl -fsS http://127.0.0.1:3001/health
```

Both `app` and `worker` should become healthy, `migrate` should exit successfully, and `postgres` should remain healthy.

The deploy script automatically backs up a running database before an update, rebuilds the images, applies migrations, and waits up to three minutes for all health checks. Application containers run as a non-root user with Linux capabilities dropped, privilege escalation disabled, and bounded Docker JSON logs.

## Caddy

Use [deploy/Caddyfile.example](deploy/Caddyfile.example) as the starting point. It enables strict trusted-proxy parsing for Cloudflare, overwrites upstream client-IP headers, and writes permission-restricted JSON access logs with 10 MiB rotation, seven rolled files, and seven-day retention. Re-check Cloudflare's published ranges before every proxy change.

Validate the final configuration, then restart Caddy in a short maintenance window because changes to an existing file output may not take effect on reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

Install the host collector after setting the same strong ingestion secret in `.env` and `/etc/bufferdash-agent.env`:

```bash
sudo scripts/install-host-agent.sh
sudoedit /etc/bufferdash-agent.env
sudo scripts/install-host-agent.sh
systemctl status bufferdash-host-agent
```

The agent posts only to `http://127.0.0.1:3001`, strips queries before transmission, retains its inode/offset checkpoint only after successful ingestion, and reads VPS metrics from `/proc`, `/sys`, and the root filesystem.

Allow only SSH, HTTP, and HTTPS through the VPS firewall. Port 3000 must remain bound to loopback, and PostgreSQL must not be exposed publicly.

## Connect a site

Create an `example.com` site in BufferDash, then configure the tracked application:

```env
BUFFERDASH_URL=https://analytics.example.com
BUFFERDASH_SITE_ID=example-com-generated-key
```

Restart or redeploy the application, then confirm its tracker loader points to the BufferDash instance.

## Backups and updates

Schedule `scripts/backup-postgres.sh`, copy encrypted backups off the VPS, and test restoration periodically. The host does not need Node.js or npm for backup and deployment operations.

```bash
git pull --ff-only
scripts/deploy-production.sh .env
```

To use a separate environment file, pass it explicitly to operational scripts:

```bash
scripts/production-check.sh .env.production
scripts/deploy-production.sh .env.production
ENV_FILE=.env.production scripts/backup-postgres.sh
```

Restore only during a maintenance window, with both database clients stopped:

```bash
docker compose stop app worker
scripts/restore-postgres.sh backups/bufferdash-YYYYMMDDTHHMMSSZ.dump
docker compose up -d
```

## Final checks

- Log in and log out successfully over HTTPS.
- Confirm protected dashboard routes redirect when logged out.
- Create a site with the exact domain of the tracked application.
- Confirm its live tracker loader points to the BufferDash instance.
- Confirm a page view appears in BufferDash.
- Confirm query strings containing test values do not appear in events.
- Confirm PostgreSQL and the configured application port are unreachable from the public internet.
- Confirm Settings shows fresh `caddy` and `host` collectors, then compare Runtime against `top`, `free`, `df /`, and `/proc/uptime`.
- Generate controlled 404 and 500 responses and confirm sanitized samples appear under HTTP.
- Confirm backups exist off-host and can be restored.
