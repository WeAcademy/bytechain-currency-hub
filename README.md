# bytechain-currency-hub

A standalone NestJS service that serves historical cryptocurrency and fiat
currency records for the ByteChain Academy Currency Hub. It was extracted from
the `currencies` module in
[bytechain-academy-backend](https://github.com/WeAcademy/bytechain-academy-backend)
so it can be deployed, scaled and evolved independently.

The service keeps the same data model and API shape as the original module,
removes the host application's JWT/role dependencies, and protects writes with a
deploy-time admin API key.

## Part of the ByteChain Academy ecosystem

| Repo | Purpose |
|------|---------|
| [bytechain-academy-frontend](https://github.com/WeAcademy/bytechain-academy-frontend) | Next.js web app |
| [bytechain-academy-backend](https://github.com/WeAcademy/bytechain-academy-backend) | NestJS REST API |
| **bytechain-currency-hub** (this repo) | Currency history data service |
| [bytechain-contracts](https://github.com/WeAcademy/bytechain-contracts) | Soroban smart contracts |
| [bytechain-indexer](https://github.com/WeAcademy/bytechain-indexer) | On-chain event indexer |
| [bytechain-shared](https://github.com/WeAcademy/bytechain-shared) | Shared TypeScript types |

## Features

- Public, paginated currency list with type and name/symbol search.
- Lookup by UUID or ticker symbol.
- Full detail plus date-filtered price history.
- Admin-only create, update and delete endpoints guarded by
  `x-admin-api-key`.
- SQLite by default; PostgreSQL when `DATABASE_URL` is set.
- Bundled seed data (15 crypto/fiat entries) with 12 months of generated
  history, deduplicated so it is safe to run repeatedly.
- Swagger UI at `/docs`, health probes at `/api/v1/health` and
  `/api/v1/ready`.
- Validation, consistent errors and graceful shutdown.

## Getting started

```bash
git clone https://github.com/WeAcademy/bytechain-currency-hub.git
cd bytechain-currency-hub
cp .env.example .env
npm install
npm run start:dev
```

The API is available at `http://localhost:3002/api/v1` and Swagger at
`http://localhost:3002/docs`.

In development the service seeds the bundled currencies on first start. To seed
manually (for example in production):

```bash
npm run seed
```

Set `SEED_ON_STARTUP=false` to disable automatic seeding. Existing rows are
never overwritten.

## API

All routes are under the global prefix `/api/v1`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/currencies` | Public | Paginated list; filters: `type`, `search`, `page`, `limit` |
| `GET` | `/currencies/symbol/:symbol` | Public | Lookup by ticker (case-insensitive) |
| `GET` | `/currencies/:id` | Public | Full entry including `historicalData` |
| `GET` | `/currencies/:id/history?from=&to=` | Public | History filtered by `YYYY-MM-DD` dates |
| `POST` | `/currencies` | Admin | Create an entry |
| `PATCH` | `/currencies/:id` | Admin | Partially update an entry |
| `DELETE` | `/currencies/:id` | Admin | Delete an entry |
| `GET` | `/health` | Public | Liveness |
| `GET` | `/ready` | Public | Readiness with `SELECT 1` |

List response shape:

```json
{
  "items": [
    {
      "id": "8f14e45f-ceea-467f-a8d0-1b2f1c0f9d4e",
      "name": "Bitcoin",
      "symbol": "BTC",
      "type": "CRYPTO",
      "description": "Bitcoin is ...",
      "logoUrl": null,
      "launchYear": 2009,
      "createdAt": "2026-11-04T10:00:00.000Z",
      "updatedAt": "2026-11-04T10:00:00.000Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 10,
  "totalPages": 2
}
```

Write requests must include the key configured in `ADMIN_API_KEY`:

```bash
curl -X POST http://localhost:3002/api/v1/currencies \
  -H 'content-type: application/json' \
  -H "x-admin-api-key: $ADMIN_API_KEY" \
  -d '{
    "name": "Stellar",
    "symbol": "XLM",
    "type": "CRYPTO",
    "description": "The native asset of the Stellar network.",
    "launchYear": 2014
  }'
```

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Runtime mode |
| `PORT` | `3002` | HTTP port |
| `CORS_ORIGIN` | any | Comma-separated allowed origins |
| `DATABASE_URL` | unset | PostgreSQL URL; when unset, SQLite is used |
| `DATABASE_PATH` | `data/currencies.sqlite` | SQLite file path |
| `DB_SYNCHRONIZE` | `true` | TypeORM schema sync; set `false` after adding migrations |
| `DB_LOGGING` | `false` | Log SQL queries |
| `DB_SSL` | `false` | Enable TLS for PostgreSQL |
| `ADMIN_API_KEY` | unset | Required for write endpoints |
| `SEED_ON_STARTUP` | `true` in dev, `false` in prod | Seed bundled data on boot |

`npm run seed` reads the same variables from `.env`.

### Database notes

SQLite is the zero-config default. Set `DATABASE_URL` to use PostgreSQL:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bytechain_currencies
```

Schema synchronisation is enabled by default so a fresh checkout works without
a migration step. Before a production rollout, add TypeORM migrations and set
`DB_SYNCHRONIZE=false`; automatic sync should not be the long-term production
strategy.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled service |
| `npm run lint` | ESLint with zero warnings allowed |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest unit tests |
| `npm run seed` | Idempotent seed CLI |

## Project structure

```text
src/
  app.controller.ts          health/readiness
  app.module.ts              config, database and feature wiring
  main.ts                    global prefix, validation, CORS, Swagger
  common/
    dto/pagination.dto.ts
    guards/admin-api-key.guard.ts
  currencies/
    currencies.controller.ts
    currencies.service.ts
    dto/
    entities/currency-entry.entity.ts
    seeds/                   bundled data, seed CLI and service
  database/
    database-options.ts      SQLite/PostgreSQL selection
```

## Security

- Read endpoints are public; writes require `ADMIN_API_KEY`.
- Key comparison uses `crypto.timingSafeEqual`.
- Helmet security headers are enabled.
- DTOs are whitelisted and unknown fields are rejected.
- The service never accepts a database URL or credentials from request data.
- Store `ADMIN_API_KEY` in a secret manager in production; rotate it by
  redeploying.

## Docker

```bash
docker build -t bytechain-currency-hub .
docker run --rm -p 3002:3002 \
  -e ADMIN_API_KEY=change-me \
  -e DATABASE_PATH=/app/data/currencies.sqlite \
  -v "$PWD/data:/app/data" \
  bytechain-currency-hub
```

## Contributing

See [CONTRIBUTING.md](https://github.com/WeAcademy/ByteChain-Academy/blob/main/CONTRIBUTING.md)
for branch naming, PR standards and the Drips Wave workflow.

## License

MIT
