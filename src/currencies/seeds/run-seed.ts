import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from '../../database/database-options';
import { CurrencyEntry } from '../entities/currency-entry.entity';
import { seedCurrencies } from './seed-currencies';

async function main(): Promise<void> {
  const dataSource = new DataSource(buildDatabaseOptions(process.env));
  await dataSource.initialize();

  try {
    const result = await seedCurrencies(
      dataSource.getRepository(CurrencyEntry),
    );
    console.log(
      `Currency seed complete: ${result.created} created, ${result.skipped} skipped`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Currency seed failed:', error);
  process.exitCode = 1;
});
