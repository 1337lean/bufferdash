# BufferDash

BufferDash is a self-hosted, first-party web analytics dashboard with traffic-quality signals and optional application-runtime metrics. It was built for `buffer.lol`, but one installation can track multiple sites.

## Features

- Multi-site tracking with public site keys
- Tiny public `/tracker.js` script
- Page views, sessions, bounce rate, unique visitors, referrers, browsers, OS, devices, locations, and live visitors
- Selectable 24-hour, 7-day, 30-day, and 90-day analytics ranges
- Secure IP handling with optional anonymization and hashed IPs
- Bot, unknown-path, failed-login, and rate-limit security signals
- Optional structured SSH, Fail2Ban, and reverse-proxy event ingestion
- Protected admin dashboard with signed HTTP-only sessions and CSRF checks for UI mutations
- Background retention cleanup and optional one-minute runtime metric collection
- Docker Compose setup with PostgreSQL

## Quick Start

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

For local `npm run dev`, point `DATABASE_URL` at your local Postgres host, for example:

```env
DATABASE_URL=postgresql://bufferdash:bufferdash_password@localhost:5432/bufferdash
```

Then visit:

```txt
http://localhost:3000
```

## Docker

```bash
cp .env.example .env
# Replace every production placeholder in .env first.
docker compose up -d --build
```

The Compose stack starts PostgreSQL, waits for it to become healthy, runs Prisma migrations with the `migrate` service, and then starts the app. PostgreSQL is persisted in the `postgres_data` Docker volume and is not published on a host port. BufferDash binds only to `127.0.0.1:3000` by default.

Do not expose PostgreSQL publicly. Keep it on Docker's internal network, use a VPS firewall, and put Nginx or Caddy with HTTPS in front of the app.

## VPS Deployment

On the VPS:

```bash
git clone https://github.com/1337lean/bufferdash.git
cd bufferdash
cp .env.example .env
```

Edit `.env` before starting the stack:

```env
APP_URL=https://dash.example.com
TZ=America/New_York
DATABASE_URL=postgresql://bufferdash:replace_with_a_real_password@postgres:5432/bufferdash
POSTGRES_PASSWORD=replace_with_a_real_password
SESSION_SECRET=replace_with_a_long_random_secret
TRACKING_SECRET=replace_with_a_different_long_random_secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=replace_with_a_bcrypt_hash
TRUST_PROXY=true
ANONYMIZE_IP=true
ENABLE_SERVER_METRICS=false
IPINFO_TOKEN=
IPINFO_TIER=lite
ENABLE_LOG_INGESTION=false
INGESTION_SECRET=
```

Generate secrets and the admin password hash. Generate the hash on a trusted machine after `npm ci`; the interactive form keeps the password out of shell history:

```bash
openssl rand -base64 48
read -s ADMIN_PASSWORD; export ADMIN_PASSWORD
node -e 'require("bcryptjs").hash(process.env.ADMIN_PASSWORD, 12).then(console.log)'
unset ADMIN_PASSWORD
```

Start or update the app:

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3000/health
```

The health endpoint checks both required production configuration and the database. The container will remain unhealthy if placeholder secrets or an invalid admin password hash are still configured.

For the VPS firewall, allow only SSH, HTTP, and HTTPS from the public internet. The app should stay behind the reverse proxy on port `3000`, and PostgreSQL should not be reachable from outside Docker.

## Database Backups

Create a compressed PostgreSQL dump:

```bash
npm run db:backup
```

Restore a dump:

```bash
docker compose stop app
npm run db:restore -- backups/bufferdash-YYYYMMDDTHHMMSSZ.dump
docker compose up -d
```

For production, schedule `npm run db:backup` from cron or a systemd timer and copy the `backups/` output off the VPS.

## First Admin

Set these values in `.env`:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=
SESSION_SECRET=replace_with_a_long_random_secret
```

Generate a bcrypt password hash without putting the password in shell history:

```bash
read -s ADMIN_PASSWORD; export ADMIN_PASSWORD
node -e 'require("bcryptjs").hash(process.env.ADMIN_PASSWORD, 12).then(console.log)'
unset ADMIN_PASSWORD
```

For local development only, `ADMIN_PASSWORD` can be used as a fallback.

## Add a Website

Open `/sites`, create a site, then paste the generated snippet before `</body>` on the tracked website:

```html
<script defer src="https://dash.example.com/tracker.js" data-site-id="example-com-abc123"></script>
```

Custom events are supported:

```js
window.bufferdash.track("tool_used", {
  tool: "ping-checker"
});
```

The tracker does not collect form inputs, cookies, localStorage contents, passwords, URL fragments, or query strings by default. Add `data-include-query` only when you have audited every tracked URL and intentionally want query-string analytics.

## GeoIP

When `TRUST_PROXY=true`, BufferDash uses trusted Cloudflare or Vercel location headers when present. On a normal VPS, set `IPINFO_TOKEN` to enable server-side enrichment. `IPINFO_TIER=lite` provides country and ASN data; `core` provides city and region as well. IP lookups are cached for six hours and private network addresses are never sent to the provider.

GeoIP sends a visitor IP to the configured provider. Leave `IPINFO_TOKEN` empty if that does not fit your privacy policy.

## Optional Host Security Events

Set `ENABLE_LOG_INGESTION=true` and generate a distinct `INGESTION_SECRET` of at least 32 characters. Trusted host tooling can then send a single structured event or a batch of up to 50 events:

```bash
curl -fsS -X POST https://dash.example.com/api/security/ingest \
  -H "Authorization: Bearer $INGESTION_SECRET" \
  -H "Content-Type: application/json" \
  --data '{"source":"fail2ban","type":"ban","message":"Banned repeated SSH failures","ip":"203.0.113.10"}'
```

Keep ingestion disabled unless you actively use it. The endpoint returns `404` when disabled or unauthorized.

## Environment Variables

See `.env.example` for the full set. The most important production values are:

- `APP_URL`
- `TZ` (the dashboard's reporting timezone)
- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `TRACKING_SECRET`
- `ANONYMIZE_IP`
- `TRUST_PROXY`
- `ENFORCE_TRACKING_ORIGIN`
- `IPINFO_TOKEN` and `IPINFO_TIER` (optional)
- `ENABLE_LOG_INGESTION` and `INGESTION_SECRET` (optional)
- `METRICS_INTERVAL_SECONDS` and `CLEANUP_INTERVAL_HOURS`

Settings are environment-driven in v1 so secrets and operational toggles are not exposed through a browser editor.

## Privacy Notes

BufferDash can log IP addresses and user agents. If you deploy it, disclose analytics and IP logging in the privacy policy for every tracked site. Set `ANONYMIZE_IP=true` to store truncated IP addresses while still retaining an HMAC hash for uniqueness and abuse detection.

Data retention cleanup is available from `/settings`. It removes old events, sessions, orphaned visitor identifiers, traffic flags, and runtime metrics. The default retention window is controlled by `DATA_RETENTION_DAYS`.

The background worker performs this cleanup automatically and has its own Docker health check. The manual settings action remains available for immediate cleanup.

## Security Notes

- `.env` is ignored by Git.
- Admin sessions are signed, HTTP-only, SameSite cookies.
- UI mutations include CSRF tokens.
- Production rejects placeholder secrets, non-HTTPS `APP_URL` values, and missing bcrypt admin hashes.
- `/api/track` validates payloads with Zod and rate limits by IP.
- Tracking requests are restricted to each site's configured domain by default. This limits accidental or casual key reuse, though browser origin headers are not a substitute for a private credential.
- Query strings and fragments are excluded from tracked URLs by default.
- Public APIs never return analytics data.
- Client-submitted IP, country, city, browser, OS, and device values are not trusted.
- v1 intentionally does not include a browser terminal, arbitrary file browser, or `.env` editor.

## Reverse Proxy Example

```nginx
server {
    server_name dash.buffer.lol;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Overwrite, rather than append to, client-supplied forwarding headers.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Roadmap

- Offline MaxMind GeoIP database support
- Packaged least-privilege host agents for common SSH and reverse-proxy formats
- User roles and TOTP
- Read-only dashboards
- Scheduled uptime, latency, HTTP status, and TLS-expiry monitoring
- Public screenshots

See [DEPLOYMENT.md](DEPLOYMENT.md) for the production checklist, [SECURITY.md](SECURITY.md) for reporting and operational boundaries, and [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance.

## License

MIT
