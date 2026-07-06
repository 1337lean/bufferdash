# BufferDash

BufferDash is a self-hosted analytics, security, and server monitoring dashboard for websites and VPS deployments. It was built for `buffer.lol`, but the tracker and dashboard support multiple sites from one install.

## Features

- Multi-site tracking with public site keys
- Tiny public `/tracker.js` script
- Page views, sessions, unique visitors, referrers, browsers, OS, devices, and live visitors
- Secure IP handling with optional anonymization and hashed IPs
- Basic bot and suspicious path detection
- Protected admin dashboard with signed HTTP-only sessions and CSRF checks for UI mutations
- Server health metrics for CPU, memory, disk, load average, uptime, and network counters
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
docker compose up -d
docker compose exec app npx prisma migrate deploy
```

Do not expose PostgreSQL publicly. Keep it bound to localhost, use a VPS firewall, and put Nginx or Caddy with HTTPS in front of the app.

## First Admin

Set these values in `.env`:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=
SESSION_SECRET=replace_with_a_long_random_secret
```

Generate a bcrypt password hash:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(console.log)" 'your-password'
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

The tracker does not collect form inputs, cookies, localStorage contents, passwords, or URL fragments.

## Environment Variables

See `.env.example` for the full set. The most important production values are:

- `APP_URL`
- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `TRACKING_SECRET`
- `ANONYMIZE_IP`
- `TRUST_PROXY`

Settings are environment-driven in v1 so secrets and operational toggles are not exposed through a browser editor.

## Privacy Notes

BufferDash can log IP addresses and user agents. If you deploy it, disclose analytics and IP logging in the privacy policy for every tracked site. Set `ANONYMIZE_IP=true` to store truncated IP addresses while still retaining an HMAC hash for uniqueness and abuse detection.

Data retention cleanup is available from `/settings`. The default retention window is controlled by `DATA_RETENTION_DAYS`.

## Security Notes

- `.env` is ignored by Git.
- Admin sessions are signed, HTTP-only, SameSite cookies.
- UI mutations include CSRF tokens.
- `/api/track` validates payloads with Zod and rate limits by IP.
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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Roadmap

- GeoIP enrichment with IPinfo or MaxMind
- Fail2Ban and SSH log ingestion
- User roles and TOTP
- Read-only dashboards
- Background metric collection worker
- Public screenshots and deployment guides

## License

MIT
