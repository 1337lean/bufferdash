# Security Policy

## Project status

BufferDash is deprecated and receives no security updates. The original hosted service is offline. Anyone operating a fork is responsible for dependency updates, vulnerability handling, privacy compliance, and deployment security. Do not send vulnerability reports or real visitor data to the original repository owner.

## Operational boundaries

- The public site key is an ingestion identifier, not a credential. Origin checks reduce casual misuse but cannot stop forged server-side requests.
- Keep the dashboard behind HTTPS and use a long, unique admin password. An additional VPN or identity-aware access layer is recommended for high-risk deployments.
- PostgreSQL must remain on the internal Docker network. Port 3000 must remain bound to localhost behind the reverse proxy.
- `TRUST_PROXY=true` is safe only when the reverse proxy overwrites forwarding headers and the app is not directly reachable.
- GeoIP is optional because it sends visitor IP addresses to the configured provider.
- Host log ingestion is disabled by default and requires a separate random bearer secret.
- Runtime metrics describe what the container can observe and are not a substitute for full VPS monitoring.

If any credential is committed or exposed, remove it from use and rotate it immediately. Rewriting Git history or making the repository private is not sufficient.
