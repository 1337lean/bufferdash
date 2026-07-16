# Contributing

This repository is archived and does not accept issues or pull requests. Fork it if you want to continue development; the code is available under the [MIT License](LICENSE).

## Development

Run PostgreSQL, copy `.env.example` to `.env`, and use non-production development values.

```bash
npm ci
npx prisma migrate dev
npm run dev
```

Before publishing a change in a fork:

```bash
npm run validate
docker compose config --quiet
```

Changes to `prisma/schema.prisma` must include a reviewed migration. Security-sensitive changes should include focused tests. Never commit `.env`, logs, database dumps, visitor data, production hostnames, or credentials.

Keep public ingestion endpoints small and bounded. Analytics reads and operational mutations must remain authenticated and server-side.
