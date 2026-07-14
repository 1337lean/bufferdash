# BufferDash

BufferDash is a self-hosted, first-party web analytics dashboard with traffic-quality signals and optional application-runtime metrics. One installation can track multiple sites.

## Features

- Multi-site tracking with public site keys
- Tiny public `/tracker.js` script
- Page views, sessions, bounce rate, unique visitors, referrers, browsers, OS, devices, locations, and live visitors
- Selectable 24-hour, 7-day, 30-day, and 90-day analytics ranges
- Secure IP handling with optional anonymization and hashed IPs
- Bot, unknown-path, failed-login, and rate-limit security signals
- Protected admin dashboard with signed HTTP-only sessions and CSRF checks
- Background retention cleanup and optional runtime metric collection
- Docker Compose setup with PostgreSQL

## VPS Deployment

BufferDash should run behind Caddy or Nginx at an HTTPS hostname such as `https://dash.buffer.lol`. PostgreSQL remains inside Docker, while the app binds only to `127.0.0.1:3000`.

```bash
git clone https://github.com/1337lean/bufferdash.git
cd bufferdash
cp .env.example .env
chmod 600 .env
```

Configure `.env` before starting:

```env
LOCAL_ONLY=false
APP_URL=https://dash.buffer.lol
BIND_ADDRESS=127.0.0.1
TZ=America/New_York
DATABASE_URL=postgresql://bufferdash:YOUR_DATABASE_PASSWORD@postgres:5432/bufferdash
POSTGRES_PASSWORD=YOUR_DATABASE_PASSWORD
SESSION_SECRET=YOUR_RANDOM_SESSION_SECRET
TRACKING_SECRET=YOUR_DIFFERENT_RANDOM_TRACKING_SECRET
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD_HASH='$2b$12$YOUR_BCRYPT_HASH'
ADMIN_PASSWORD=
TRUST_PROXY=true
ANONYMIZE_IP=true
ENFORCE_TRACKING_ORIGIN=true
```

Generate separate secrets and a password hash on a trusted machine after `npm ci`:

```bash
openssl rand -base64 48
openssl rand -base64 48
read -s ADMIN_PASSWORD; export ADMIN_PASSWORD
node -e 'require("bcryptjs").hash(process.env.ADMIN_PASSWORD, 12).then(console.log)'
unset ADMIN_PASSWORD
```

Start and verify:

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3000/health
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for Caddy, firewall, update, backup, and final verification guidance.

## Connect buffer.lol

After signing in at `https://dash.buffer.lol`, open `/sites`, create a site with domain `buffer.lol`, and copy its generated public site key. Set these values for the `buffer.lol` application on the VPS:

```env
BUFFERDASH_URL=https://dash.buffer.lol
BUFFERDASH_SITE_ID=buffer-lol-generated-key
```

Restart or redeploy `buffer.lol`. Its `/bufferdash.js` loader will then inject the BufferDash tracker on every page.

## Local Development

For a local installation, set `LOCAL_ONLY=true`, use `APP_URL=http://localhost:3000`, keep `BIND_ADDRESS=127.0.0.1`, and set `TRUST_PROXY=false`. Local mode accepts `ADMIN_PASSWORD`; hosted production requires `ADMIN_PASSWORD_HASH`.

```bash
npm install
npx prisma migrate dev
npm run dev
```

The development server binds only to `127.0.0.1`.

## Database Backups

```bash
npm run db:backup
```

Restore a dump:

```bash
docker compose stop app
npm run db:restore -- backups/bufferdash-YYYYMMDDTHHMMSSZ.dump
docker compose up -d
```

For production, schedule backups and copy them off the VPS. Test restoration periodically.

## Tracking

The generated snippet looks like:

```html
<script defer src="https://dash.buffer.lol/tracker.js" data-site-id="buffer-lol-generated-key"></script>
```

Custom events are supported:

```js
window.bufferdash.track("tool_used", {
  tool: "ping-checker"
});
```

The tracker excludes form inputs, cookies, localStorage contents, passwords, URL fragments, and query strings by default. Add `data-include-query` only after auditing every tracked URL.

## GeoIP

When `TRUST_PROXY=true`, BufferDash uses trusted Cloudflare or Vercel location headers when present. Set `IPINFO_TOKEN` for server-side enrichment when appropriate. `IPINFO_TIER=lite` provides country and ASN data; `core` also provides city and region.

GeoIP sends visitor IPs to the configured provider. Leave the token empty if that does not fit your privacy policy.

## Important Environment Variables

- `LOCAL_ONLY`
- `APP_URL`
- `BIND_ADDRESS`
- `TZ`
- `DATABASE_URL` and `POSTGRES_PASSWORD`
- `SESSION_SECRET` and `TRACKING_SECRET`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH`
- `TRUST_PROXY`
- `ANONYMIZE_IP`
- `ENFORCE_TRACKING_ORIGIN`
- `IPINFO_TOKEN` and `IPINFO_TIER`
- `ENABLE_LOG_INGESTION` and `INGESTION_SECRET`
- `ENABLE_SERVER_METRICS`
- `DATA_RETENTION_DAYS`

## Security Notes

- Hosted production rejects HTTP app URLs, placeholder secrets, missing bcrypt hashes, and weak database credentials.
- The app stays bound to loopback behind the HTTPS reverse proxy.
- PostgreSQL is not published on a host port.
- Admin sessions are signed, HTTP-only, SameSite cookies.
- UI mutations require CSRF tokens.
- Tracking requests are origin-checked and rate-limited.
- Query strings and fragments are excluded by default.
- Client-submitted IP, country, browser, OS, and device values are not trusted.

BufferDash can log IP addresses and user agents. Set `ANONYMIZE_IP=true` and disclose analytics collection in the privacy policy for every tracked site.
