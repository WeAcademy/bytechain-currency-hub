import { DataSource, Repository } from 'typeorm';
import { CurrencyEntry } from '../entities/currency-entry.entity';
import { CURRENCIES } from './currency-data';
import { seedCurrencies } from './seed-currencies';

describe('seedCurrencies', () => {
  let dataSource: DataSource;
  let repository: Repository<CurrencyEntry>;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [CurrencyEntry],
      synchronize: true,
    });
    await dataSource.initialize();
    repository = dataSource.getRepository(CurrencyEntry);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('inserts every bundled currency and is idempotent', async () => {
    const first = await seedCurrencies(repository);
    expect(first.created).toBe(CURRENCIES.length);
    expect(first.skipped).toBe(0);

    const second = await seedCurrencies(repository);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(CURRENCIES.length);

    const rows = await repository.find();
    expect(rows).toHaveLength(CURRENCIES.length);
    expect(rows.every((row) => row.historicalData?.length === 12)).toBe(true);
    expect(rows.find((row) => row.symbol === 'BTC')?.launchYear).toBe(2009);
  });
});
