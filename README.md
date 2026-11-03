# bytechain-currency-hub

A standalone data service that provides historical records for every major cryptocurrency — prices, market cap, circulating supply, and on-chain metrics. Serves as the dedicated backend for the ByteChain Academy Currency Hub feature.

## Part of the ByteChain Academy multi-repo ecosystem

| Repo | Purpose |
|------|---------|
| [bytechain-academy-frontend](https://github.com/WeAcademy/bytechain-academy-frontend) | Next.js web app — UI for students, tutors, and admins |
| [bytechain-academy-backend](https://github.com/WeAcademy/bytechain-academy-backend) | NestJS REST API — auth, courses, progress, DAO, certificates |
| **bytechain-currency-hub** (this repo) | Standalone crypto currency history data service |
| [bytechain-contracts](https://github.com/WeAcademy/bytechain-contracts) | Smart contracts — DAO governance, SBT certificates, reward token |
| [bytechain-indexer](https://github.com/WeAcademy/bytechain-indexer) | On-chain event listener that syncs blockchain state to the backend |
| [bytechain-shared](https://github.com/WeAcademy/bytechain-shared) | Shared TypeScript types and contract ABIs used across all repos |

---

## What this service does

The Currency Hub is a searchable, paginated knowledge base covering the history of every cryptocurrency that has ever existed. It is intentionally a separate service so it can:

- Be deployed and scaled independently from the Academy backend
- - Be consumed by other products or third parties via a public API
  - - Pull live data from external sources (CoinGecko, CoinMarketCap, Stellar DEX) without coupling that complexity to the main API
    - - Evolve its own data pipeline and storage strategy (e.g. TimescaleDB for time-series data)
     
      - ---

      ## Planned tech stack

      | Layer | Technology |
      |-------|-----------|
      | Framework | NestJS or Fastify/Hono (TypeScript) |
      | Database | PostgreSQL or TimescaleDB (time-series optimised) |
      | Data ingestion | Scheduled jobs pulling from CoinGecko / CoinMarketCap APIs |
      | Caching | Redis (for frequently accessed coin data) |
      | Search | Full-text search by name and symbol |
      | Auth | API key for write operations, public read endpoints |

      ---

      ## API endpoints (planned)

      | Method | Path | Description |
      |--------|------|-------------|
      | `GET` | `/currencies` | Paginated list of all currencies, filterable by type and search |
      | `GET` | `/currencies/:id` | Full detail for a single currency including historical data |
      | `GET` | `/currencies/symbol/:symbol` | Lookup by ticker symbol (e.g. BTC, ETH) |
      | `GET` | `/currencies/:id/history?from=&to=` | Filtered price history for a date range |
      | `POST` | `/currencies` | Admin: create a new currency entry |
      | `PATCH` | `/currencies/:id` | Admin: update currency metadata |
      | `DELETE` | `/currencies/:id` | Admin: remove a currency entry |

      ---

      ## Current state

      The currencies data currently lives as a module inside [bytechain-academy-backend](https://github.com/WeAcademy/bytechain-academy-backend) with a seeded SQLite/PostgreSQL database. Extracting it into this dedicated service is the next step. The existing data model and seed scripts will be migrated here.

      ---

      ## Getting started (once implemented)

      ```bash
      git clone https://github.com/WeAcademy/bytechain-currency-hub.git
      cd bytechain-currency-hub
      cp .env.example .env
      npm install
      npm run start:dev
      ```

      ---

      ## Contributing

      See [CONTRIBUTING.md](https://github.com/WeAcademy/ByteChain-Academy/blob/main/CONTRIBUTING.md) for branch naming, PR standards, and the Drips Wave contribution workflow.

      ## License

      MIT

---

## Documentation

- [Data sources and ingestion schema](docs/data-sources.md) — upstream
  providers, canonical asset keys, storage schema, cadence, retries and API
  mapping.
