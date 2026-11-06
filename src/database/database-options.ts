import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { CurrencyEntry } from '../currencies/entities/currency-entry.entity';

export interface DatabaseEnv {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  DATABASE_PATH?: string;
  DB_SYNCHRONIZE?: string;
  DB_LOGGING?: string;
  DB_SSL?: string;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === 'true';
}

/**
 * Build TypeORM options for both the Nest application and the seed CLI.
 *
 * SQLite is the zero-config default. Set DATABASE_URL to use PostgreSQL.
 * `synchronize` defaults to true so the service works out of the box; set
 * DB_SYNCHRONIZE=false once migrations are introduced for production.
 */
export function buildDatabaseOptions(
  env: DatabaseEnv = process.env,
): DataSourceOptions {
  const logging = bool(env.DB_LOGGING, false);
  const synchronize = bool(env.DB_SYNCHRONIZE, true);

  if (env.DATABASE_URL) {
    return {
      type: 'postgres',
      url: env.DATABASE_URL,
      entities: [CurrencyEntry],
      synchronize,
      logging,
      ssl: bool(env.DB_SSL, false) ? { rejectUnauthorized: false } : false,
    };
  }

  const database = env.DATABASE_PATH || 'data/currencies.sqlite';
  if (database !== ':memory:') {
    mkdirSync(dirname(database), { recursive: true });
  }

  return {
    type: 'better-sqlite3',
    database,
    entities: [CurrencyEntry],
    synchronize,
    logging,
  };
}
