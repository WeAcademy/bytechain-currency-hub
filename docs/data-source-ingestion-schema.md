# Data Sources and Ingestion Schema

## Overview

This document defines the list of data sources for currency price and metadata ingestion, and the schema for how data flows from those sources into the currency-hub database.

## Data sources

### Primary: CoinGecko API

CoinGecko provides free and paid tiers for cryptocurrency price data, market cap, and metadata.

| Endpoint | Purpose | Rate limit (free) |
|----------|---------|-------------------|
| `/coins/markets` | Current prices, market cap, 24h volume | 10-30 req/min |
| `/coins/{id}/market_chart` | Historical OHLC prices (daily) | 10-30 req/min |
| `/coins/{id}` | Metadata (description, logo, launch date) | 10-30 req/min |
| `/simple/price` | Simple current price lookup | 10-50 req/min |

**Authentication**: API key via `x-cg-demo-api-key` header (demo) or `x-cg-pro-api-key` (paid).

### Secondary: CoinMarketCap API

CoinMarketCap provides similar data with a free tier (10,000 credits/month).

| Endpoint | Purpose | Credit cost |
|----------|---------|-------------|
| `/v2/cryptocurrency/quotes/latest` | Current prices and market data | 1 per request |
| `/v2/cryptocurrency/info` | Metadata | 1 per request |
| `/v1/exchange/rate/list` | Fiat exchange rates | 1 per request |

**Authentication**: API key via `X-CMC_PRO_API_KEY` header.

### Fiat exchange rates: Open Exchange Rates

| Endpoint | Purpose |
|----------|---------|
| `/latest.json` | Current fiat-to-USD rates |
| `/historical/{date}.json` | Historical fiat rates |

**Authentication**: `app_id` query parameter.

### Manual/seed data

The existing seed data (from the backend currencies module) provides baseline metadata for 10 crypto and 5 fiat currencies. This serves as a fallback and for development environments without API access.

## Ingestion schema

### `currency_entries` table (metadata — extracted from backend)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `name` | VARCHAR UNIQUE | Full name (e.g., "Bitcoin") |
| `symbol` | VARCHAR UNIQUE | Ticker (e.g., "BTC") |
| `type` | ENUM('CRYPTO', 'FIAT') | Currency category |
| `description` | TEXT | Long-form description |
| `logoUrl` | VARCHAR NULL | Logo image URL |
| `launchYear` | INT NULL | Launch/founding year |
| `createdAt` | TIMESTAMP | Auto |
| `updatedAt` | TIMESTAMP | Auto |

### `price_history` table (new — ingestion target)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `currencyId` | UUID FK → `currency_entries.id` | Not null |
| `date` | DATE | Price date (YYYY-MM-DD) |
| `price` | NUMERIC(20,8) | Price in USD |
| `marketCap` | NUMERIC(20,2) NULL | Market cap in USD |
| `circulatingSupply` | NUMERIC(20,2) NULL | Circulating supply |
| `volume24h` | NUMERIC(20,2) NULL | 24-hour trading volume |
| `source` | VARCHAR(50) | Data source (e.g., "coingecko") |
| `createdAt` | TIMESTAMP | Ingestion timestamp |
| **Unique** | `(currencyId, date)` | No duplicate entries per day |

### `ingestion_runs` table (audit log)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `source` | VARCHAR(50) | Data source name |
| `startedAt` | TIMESTAMP | Run start time |
| `completedAt` | TIMESTAMP NULL | Run end time (null if failed) |
| `status` | ENUM('running', 'success', 'failed') | Run status |
| `recordsProcessed` | INT | Number of records written |
| `error` | TEXT NULL | Error message if failed |
| `metadata` | JSONB NULL | Additional run info |

## Ingestion pipeline

```
CoinGecko API → [IngestionService] → price_history table
                         ↓
                 ingestion_runs table (audit)
```

### Steps

1. **Fetch**: For each tracked currency, call the CoinGecko API for current and historical prices.
2. **Transform**: Map API response to `price_history` record format.
3. **Deduplicate**: Check `(currencyId, date)` uniqueness before insert.
4. **Write**: Upsert into `price_history` (INSERT ... ON CONFLICT DO UPDATE).
5. **Audit**: Log the run in `ingestion_runs` with status, count, and timing.

### Scheduling

- **Current prices**: Every 15 minutes (configurable via `INGESTION_INTERVAL_CRON`)
- **Historical backfill**: Daily at 02:00 UTC for the previous day
- **Full metadata refresh**: Weekly (descriptions, logos, launch years)

### Error handling

- API timeout: Retry 3 times with exponential backoff (1s, 2s, 4s)
- Rate limit (429): Respect `Retry-After` header, pause ingestion
- Invalid data: Log and skip the record, continue with the batch
- Partial failure: Mark the ingestion run as 'failed' with the error, but keep successfully ingested records

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COINGECKO_API_KEY` | No | — | CoinGecko demo/pro API key |
| `COINMARKETCAP_API_KEY` | No | — | CoinMarketCap API key |
| `OPENEXCHANGERATES_APP_ID` | No | — | Open Exchange Rates app ID |
| `INGESTION_INTERVAL_CRON` | No | `*/15 * * * *` | Current price ingestion cron |
| `INGESTION_HISTORICAL_CRON` | No | `0 2 * * *` | Historical backfill cron |
| `DB_HOST` | Yes | `localhost` | PostgreSQL host |
| `DB_PORT` | Yes | `5432` | PostgreSQL port |
| `DB_USERNAME` | Yes | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | Yes | — | PostgreSQL password |
| `DB_NAME` | Yes | `bytechain_currency_hub` | Database name |

## Future extensions

- Real-time WebSocket price feeds (CoinGecko Pro)
- On-chain data sources (Stellar network for XLM, DEX data)
- User-submitted price corrections with admin approval
- Currency correlation and analytics endpoints
- Webhook notifications when prices change beyond a threshold
