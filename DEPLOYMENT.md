# Production Deployment

## Prerequisites

- A Linux VPS with current security updates
- Docker Engine with the Compose plugin
- A DNS record for `dash.buffer.lol` pointing to the VPS
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

Recommended values:

```env
LOCAL_ONLY=false
APP_URL=https://dash.buffer.lol
BIND_ADDRESS=127.0.0.1
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

Both `app` and `worker` should become healthy, `migrate` should exit successfully, and `postgres` should remain healthy.

## Caddy

```caddy
dash.buffer.lol {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Allow only SSH, HTTP, and HTTPS through the VPS firewall. Port 3000 must remain bound to loopback, and PostgreSQL must not be exposed publicly.

## Connect buffer.lol

Create a `buffer.lol` site in BufferDash, then configure the `buffer.lol` container:

```env
BUFFERDASH_URL=https://dash.buffer.lol
BUFFERDASH_SITE_ID=buffer-lol-generated-key
```

Restart or redeploy `buffer.lol`, then confirm `https://buffer.lol/bufferdash.js` loads the tracker rather than the disabled stub.

## Backups and updates

Schedule `npm run db:backup`, copy encrypted backups off the VPS, and test restoration periodically.

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
```

## Final checks

- Log in and log out successfully over HTTPS.
- Confirm protected dashboard routes redirect when logged out.
- Create a site with the exact `buffer.lol` domain.
- Confirm the live `buffer.lol/bufferdash.js` loader points to `dash.buffer.lol/tracker.js`.
- Confirm a page view appears in BufferDash.
- Confirm query strings containing test values do not appear in events.
- Confirm PostgreSQL and port 3000 are unreachable from the public internet.
- Confirm backups exist off-host and can be restored.
