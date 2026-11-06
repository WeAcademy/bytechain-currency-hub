import { QueryFailedError, Repository } from 'typeorm';
import { CurrencyEntry } from '../entities/currency-entry.entity';
import {
  CURRENCIES,
  PRICE_RANGES,
  generateHistoricalData,
} from './currency-data';

export interface SeedResult {
  created: number;
  skipped: number;
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const code = (error as QueryFailedError & { code?: string }).code;
  const message = error.message.toLowerCase();
  return (
    code === '23505' ||
    code === 'SQLITE_CONSTRAINT' ||
    message.includes('unique constraint')
  );
}

/**
 * Insert the bundled currencies that are not already stored.
 *
 * Existing rows are never overwritten, so operator edits survive restarts and
 * this function is safe to run repeatedly.
 */
export async function seedCurrencies(
  repository: Repository<CurrencyEntry>,
): Promise<SeedResult> {
  const existing = await repository.find({ select: { symbol: true } });
  const symbols = new Set(existing.map((entry) => entry.symbol));

  let created = 0;
  let skipped = 0;

  for (const data of CURRENCIES) {
    if (!data.symbol || symbols.has(data.symbol)) {
      skipped += 1;
      continue;
    }

    const [min, max] = PRICE_RANGES[data.symbol] ?? [1, 1];
    const currency = repository.create({
      ...data,
      historicalData: data.historicalData ?? generateHistoricalData(min, max),
    });

    try {
      await repository.save(currency);
      symbols.add(data.symbol);
      created += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return { created, skipped };
}
