# Data sources and ingestion schema

This document defines where Currency Hub data comes from, how each record is
keyed, and the shape written to storage. It is the contract between the
ingestion workers and the read API.

## 1. Source list

| # | Source | Used for | Auth | Default cadence |
|---|--------|----------|------|-----------------|
| 1 | [CoinGecko API](https://docs.coingecko.com/) | Market price, market cap, 24h volume, circulating supply, coin metadata, historical charts | `x-cg-demo-api-key` header (demo) or `x-cg-pro-api-key` (pro) | Every 5 minutes for tracked assets; daily backfill |
| 2 | [Stellar Horizon](https://developers.stellar.org/docs/data/apis/horizon) | Native XLM and issued Stellar assets: asset list, issuer, order book, trade aggregates | None (public, rate limited) | Every 15 minutes |
| 3 | Stellar RPC (`getLedgerEntries`, `getEvents`) | Soroban token metadata and contract IDs for on-chain assets | None (public RPC) | Hourly |
| 4 | [CoinMarketCap](https://coinmarketcap.com/api/documentation/v1/) | Fallback quotes when CoinGecko has no listing or is unavailable | `X-CMC_PRO_API_KEY` header | On demand / failover |

### Why these sources

- **CoinGecko is the primary market source.** It covers long-tail coins,
  supplies historical charts, and exposes a stable coin `id` we can store as an
  external key. The free demo tier allows 30 calls/minute; a single
  `/coins/markets` call can return up to 250 assets, so one call per page keeps
  the worker inside the budget.
- **Horizon is authoritative for Stellar assets.** CoinGecko does not know about
  most issued assets or Soroban tokens, but Horizon exposes the issuer and
  flags (`auth_required`, `auth_revocable`) needed to display trustline data.
- **Stellar RPC covers Soroban contract tokens** that never appear in Horizon's
  classic asset list.
- **CoinMarketCap is failover only.** It has a much smaller free credit budget
  (333 credits/day), so the worker uses it when CoinGecko returns no quote for
  an asset that is otherwise active.

### Explicitly out of scope

- Scraping exchange pages.
- User-supplied price submissions.
- DEX trade-level data beyond daily aggregates; the Hub shows history, not a
  trading terminal.

## 2. Canonical asset identity

Every asset gets a stable `asset_key` before any quote is stored. This prevents
the same coin being ingested twice under different source IDs.

| Asset kind | `asset_key` format | Example |
|------------|--------------------|---------|
| Stellar native | `stellar:native` | `stellar:native` |
| Stellar issued asset | `stellar:<CODE>:<ISSUER>` | `stellar:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| Soroban token | `soroban:<CONTRACT_ID>` | `soroban:CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| External coin | `coingecko:<id>` | `coingecko:bitcoin` |

Source-specific identifiers live in `asset_sources`, so an asset can be linked
to a CoinGecko ID, a CoinMarketCap ID, and a Stellar issuer at the same time.

## 3. Storage schema

PostgreSQL (or TimescaleDB). All timestamps are `timestamptz` in UTC. Monetary
values use `numeric`, never floating point.

```sql
CREATE TYPE asset_kind AS ENUM ('native', 'issued', 'soroban', 'external');
CREATE TYPE quote_source AS ENUM ('coingecko', 'coinmarketcap', 'stellar_horizon');
CREATE TYPE run_status AS ENUM ('running', 'succeeded', 'failed', 'partial');

CREATE TABLE assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_key       text NOT NULL UNIQUE,
  kind            asset_kind NOT NULL,
  symbol          text NOT NULL,
  name            text NOT NULL,
  issuer          text,
  contract_id     text,
  decimals        smallint,
  logo_url        text,
  is_active       boolean NOT NULL DEFAULT true,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issued_needs_issuer CHECK (kind <> 'issued' OR issuer IS NOT NULL),
  CONSTRAINT soroban_needs_contract CHECK (kind <> 'soroban' OR contract_id IS NOT NULL)
);

CREATE TABLE asset_sources (
  asset_id        uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  source          quote_source NOT NULL,
  source_id       text NOT NULL,
  source_payload  jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, source)
);

CREATE TABLE price_quotes (
  id                 bigserial PRIMARY KEY,
  asset_id           uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  source             quote_source NOT NULL,
  quote_currency     char(3) NOT NULL DEFAULT 'USD',
  price              numeric(28, 12) NOT NULL,
  market_cap         numeric(30, 2),
  volume_24h         numeric(30, 2),
  circulating_supply numeric(30, 8),
  observed_at        timestamptz NOT NULL,
  ingested_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_non_negative CHECK (price >= 0),
  UNIQUE (asset_id, source, quote_currency, observed_at)
);

CREATE INDEX price_quotes_asset_time_idx
  ON price_quotes (asset_id, observed_at DESC);

CREATE TABLE ingestion_runs (
  id             bigserial PRIMARY KEY,
  source         quote_source NOT NULL,
  job            text NOT NULL,
  status         run_status NOT NULL DEFAULT 'running',
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  records_read   integer NOT NULL DEFAULT 0,
  records_written integer NOT NULL DEFAULT 0,
  error          text
);

CREATE TABLE ingestion_cursors (
  source      quote_source NOT NULL,
  stream      text NOT NULL,
  cursor      text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, stream)
);
```

For TimescaleDB, convert `price_quotes` to a hypertable on `observed_at` and add
a retention policy (raw 5-minute quotes for 90 days, hourly rollups kept
indefinitely).

## 4. Ingestion payload

Workers normalise every source into this JSON object before writing. The same
shape is accepted by `POST /internal/v1/quotes` in dry-run mode.

```json
{
  "asset": {
    "asset_key": "coingecko:bitcoin",
    "kind": "external",
    "symbol": "BTC",
    "name": "Bitcoin",
    "decimals": 8,
    "logo_url": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png"
  },
  "source": {
    "name": "coingecko",
    "source_id": "bitcoin",
    "fetched_at": "2026-11-03T10:05:00Z"
  },
  "quote": {
    "currency": "USD",
    "price": "68234.120000000000",
    "market_cap": "1345000000000.00",
    "volume_24h": "28500000000.00",
    "circulating_supply": "19710000.00000000",
    "observed_at": "2026-11-03T10:00:00Z"
  }
}
```

Rules:

- `price` is a decimal string, not a JSON number, so precision survives.
- `observed_at` is the source's timestamp, not the fetch time. Two runs that see
  the same observation must not create two rows.
- Missing optional fields are `null`, never `0`.
- `asset.asset_key` is immutable. A rename updates `name`/`symbol` only.

## 5. Jobs and cadence

| Job | Source | Schedule | Notes |
|-----|--------|----------|-------|
| `markets.refresh` | CoinGecko | `*/5 * * * *` | One page (250 assets) per run, cursor persisted in `ingestion_cursors` |
| `markets.backfill` | CoinGecko | Daily 02:00 UTC | 90 days of daily closes for newly added assets |
| `stellar.assets` | Horizon | `*/15 * * * *` | Paginate `/assets`; upsert issuers and flags |
| `soroban.metadata` | Stellar RPC | Hourly | Refresh name/symbol/decimals for known contracts |
| `quotes.failover` | CoinMarketCap | Event-driven | Only for active assets with no quote in 30 minutes |

Each run inserts an `ingestion_runs` row, updates its cursor in the same
transaction as the writes, and records the first error without aborting the
whole batch (`status = 'partial'`).

## 6. Rate limits, retries and idempotency

- **Budget:** CoinGecko demo allows 30 req/min. The worker uses at most 20 and
  sleeps until the next window when the remaining header is low.
- **Retries:** exponential backoff (1s, 2s, 4s, 8s, 16s, capped at 60s) for 429
  and 5xx, maximum 5 attempts. 4xx other than 429 is not retried.
- **Idempotency:** `UNIQUE (asset_id, source, quote_currency, observed_at)` plus
  `INSERT ... ON CONFLICT DO NOTHING`. Re-running a job is always safe.
- **Circuit breaker:** three consecutive failed runs for a source mark it
  degraded and alert; failover to CoinMarketCap is automatic for quotes.
- **Timeouts:** 10s connect / 30s total per HTTP request.

## 7. Configuration

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | yes | PostgreSQL/TimescaleDB connection string |
| `COINGECKO_API_KEY` | yes | Demo or Pro key |
| `COINGECKO_TIER` | no | `demo` (default) or `pro`; selects header and rate budget |
| `CMC_API_KEY` | no | Enables CoinMarketCap failover |
| `STELLAR_HORIZON_URL` | no | Defaults to `https://horizon.stellar.org` |
| `STELLAR_RPC_URL` | no | Defaults to `https://soroban-testnet.stellar.org` |
| `INGEST_MARKETS_CRON` | no | Override the 5-minute schedule |
| `LOG_LEVEL` | no | `info` by default |

## 8. Mapping to the public API

| API field | Origin |
|-----------|--------|
| `asset.id` | `assets.asset_key` |
| `asset.symbol`, `asset.name`, `asset.logoUrl` | `assets` |
| `asset.price`, `marketCap`, `volume24h`, `circulatingSupply` | Latest `price_quotes` row |
| `asset.change24h` | Latest quote vs. the quote closest to 24 hours earlier |
| `history[]` | `price_quotes` aggregated to the requested interval |
| `asset.sources[]` | `asset_sources` |

Read endpoints never call upstream APIs; they serve only stored data, so a
source outage degrades freshness rather than availability.
