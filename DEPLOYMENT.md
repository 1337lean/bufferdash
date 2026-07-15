# Production Deployment

## Prerequisites

- A Linux VPS with current security updates
- Docker Engine with the Compose plugin
- A DNS record for `dash.buffer.lol` pointing to the VPS
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
APP_URL=https://dash.buffer.lol
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

## Connect buffer.lol

Create a `buffer.lol` site in BufferDash, then configure the `buffer.lol` container:

```env
BUFFERDASH_URL=https://dash.buffer.lol
BUFFERDASH_SITE_ID=buffer-lol-generated-key
```

Restart or redeploy `buffer.lol`, then confirm `https://buffer.lol/bufferdash.js` loads the tracker rather than the disabled stub.

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

## GitHub Actions deployment

The validation workflow deploys a push to `main` only after lint, type checking, tests, migrations, and the production build pass. The deploy job connects with a dedicated SSH key whose `authorized_keys` entry is restricted to the deployment entrypoint. Production secrets remain in `/opt/bufferdash/.env` on the VPS and are never copied to GitHub.

Generate a dedicated key on a trusted workstation. Do not add a passphrase because the Actions runner cannot answer an interactive prompt:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/bufferdash-actions -C github-actions-bufferdash -N ''
```

Copy and install the entrypoint on the VPS:

```bash
scp scripts/vps-deploy-entrypoint.sh lean@VPS_IP:/tmp/bufferdash-deploy
ssh lean@VPS_IP 'sudo install -o root -g root -m 755 /tmp/bufferdash-deploy /usr/local/bin/bufferdash-deploy && rm /tmp/bufferdash-deploy'
```

On the VPS, append the public key to `/home/lean/.ssh/authorized_keys` with this prefix, keeping the complete `ssh-ed25519 ...` public key on the same line:

```text
restrict,command="/usr/local/bin/bufferdash-deploy" ssh-ed25519 PUBLIC_KEY github-actions-bufferdash
```

Secure the SSH files:

```bash
chmod 700 /home/lean/.ssh
chmod 600 /home/lean/.ssh/authorized_keys
```

Create a GitHub environment named `production`, restrict its deployment branch to `main`, and add:

- Environment variable `VPS_HOST`: the VPS IP address or a DNS name that resolves directly to it
- Environment variable `VPS_USER`: `lean`
- Environment variable `VPS_PORT`: the SSH port, normally `22`
- Environment secret `VPS_DEPLOY_KEY`: the complete contents of `~/.ssh/bufferdash-actions`
- Environment secret `VPS_KNOWN_HOSTS`: trusted `ssh-keyscan` output for the same host and port

Before trusting `ssh-keyscan` output, compare its ED25519 fingerprint with the host fingerprint shown directly on the VPS:

```bash
# On the VPS
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub

# On the trusted workstation
ssh-keyscan -p 22 VPS_IP > /tmp/bufferdash-known-hosts
ssh-keygen -lf /tmp/bufferdash-known-hosts
```

After the fingerprints match, paste the complete contents of `/tmp/bufferdash-known-hosts` into `VPS_KNOWN_HOSTS`. Never commit the private key or the production `.env`.

The VPS checkout must remain on `main` and clean. Each deployment fetches `origin/main`, accepts only a requested commit that belongs to that branch, fast-forwards without overwriting server changes, runs the production preflight, backs up PostgreSQL, rebuilds the containers, applies migrations, and waits for health checks.

Restore only during a maintenance window, with both database clients stopped:

```bash
docker compose stop app worker
scripts/restore-postgres.sh backups/bufferdash-YYYYMMDDTHHMMSSZ.dump
docker compose up -d
```

## Final checks

- Log in and log out successfully over HTTPS.
- Confirm protected dashboard routes redirect when logged out.
- Create a site with the exact `buffer.lol` domain.
- Confirm the live `buffer.lol/bufferdash.js` loader points to `dash.buffer.lol/tracker.js`.
- Confirm a page view appears in BufferDash.
- Confirm query strings containing test values do not appear in events.
- Confirm PostgreSQL and the configured application port are unreachable from the public internet.
- Confirm Settings shows fresh `caddy` and `host` collectors, then compare Runtime against `top`, `free`, `df /`, and `/proc/uptime`.
- Generate controlled 404 and 500 responses and confirm sanitized samples appear under HTTP.
- Confirm backups exist off-host and can be restored.
