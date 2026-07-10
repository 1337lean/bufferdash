# Contributing

## Development

Run PostgreSQL, copy `.env.example` to `.env`, and use non-production development values.

```bash
npm ci
npx prisma migrate dev
npm run dev
```

Before submitting a change:

```bash
npm run validate
docker compose config --quiet
```

Changes to `prisma/schema.prisma` must include a reviewed migration. Security-sensitive changes should include focused tests. Never commit `.env`, logs, database dumps, visitor data, production hostnames, or credentials.

Keep public ingestion endpoints small and bounded. Analytics reads and operational mutations must remain authenticated and server-side.
