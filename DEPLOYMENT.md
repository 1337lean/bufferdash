# Production Deployment

## Prerequisites

- A Linux VPS with current security updates
- Docker Engine with the Compose plugin
- A DNS record such as `dash.example.com` pointing to the VPS
- Caddy or Nginx terminating HTTPS

## Configure

```bash
git clone https://github.com/1337lean/bufferdash.git
cd bufferdash
cp .env.example .env
chmod 600 .env
```

Generate separate database, session, tracking, and optional ingestion secrets. Never reuse a secret and never commit `.env`.

Use a hexadecimal database password so it can safely appear in `DATABASE_URL`. Keep the bcrypt admin hash single-quoted in `.env` so its `$` characters remain literal.

Recommended privacy defaults:

```env
ANONYMIZE_IP=true
TRUST_PROXY=true
ENFORCE_TRACKING_ORIGIN=true
FILTER_BOTS=false
ENABLE_SERVER_METRICS=true
DATA_RETENTION_DAYS=90
```

## Start and verify

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3000/health
```

Both `app` and `worker` should become healthy, `migrate` should exit successfully, and `postgres` should remain healthy. BufferDash binds only to `127.0.0.1:3000`; PostgreSQL has no host port.

## Caddy

```caddy
dash.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Allow only SSH, HTTP, and HTTPS through the VPS firewall. If Cloudflare proxies the hostname, enable authenticated origin pulls or restrict ports 80/443 to Cloudflare's published ranges where operationally practical.

## Backups and updates

Schedule `npm run db:backup` and copy encrypted backups off the VPS. Test restoration periodically.

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
```

Database migrations run before the updated application and worker start.

## Final checks

- Log in and log out successfully over HTTPS.
- Confirm `/dashboard`, `/logs`, and `/security` redirect when logged out.
- Create a site and confirm its exact domain is configured.
- Install the snippet and check a pageview appears.
- Confirm query strings containing test values do not appear in the event stream.
- Confirm PostgreSQL and port 3000 are unreachable from the public internet.
- Confirm backups exist off-host and can be restored.
