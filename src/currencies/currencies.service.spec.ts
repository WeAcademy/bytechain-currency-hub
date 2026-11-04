import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CurrenciesService } from './currencies.service';
import { CurrencyEntry, CurrencyType } from './entities/currency-entry.entity';

describe('CurrenciesService', () => {
  let dataSource: DataSource;
  let repository: Repository<CurrencyEntry>;
  let service: CurrenciesService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [CurrencyEntry],
      synchronize: true,
    });
    await dataSource.initialize();
    repository = dataSource.getRepository(CurrencyEntry);
    service = new CurrenciesService(repository);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const createBitcoin = () =>
    service.create({
      name: 'Bitcoin',
      symbol: 'BTC',
      type: CurrencyType.CRYPTO,
      description: 'The first cryptocurrency.',
      launchYear: 2009,
      historicalData: [
        { date: '2024-01-01', price: 42000, marketCap: 800000000000 },
      ],
    });

  it('creates an entry and omits history from list responses', async () => {
    const created = await createBitcoin();
    expect(created.id).toBeDefined();
    expect(created.historicalData).toHaveLength(1);

    const result = await service.findAll();

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('historicalData');
    expect(result.items[0].symbol).toBe('BTC');
    expect(result.totalPages).toBe(1);
  });

  it('filters by type and search, and paginates', async () => {
    await createBitcoin();
    await service.create({
      name: 'Euro',
      symbol: 'EUR',
      type: CurrencyType.FIAT,
      description: 'The official currency of the eurozone.',
      launchYear: 1999,
    });

    const result = await service.findAll(CurrencyType.FIAT, 'eur', {
      page: 1,
      limit: 1,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('Euro');
    expect(result.page).toBe(1);
    expect(result.limit).toBe(1);
  });

  it('finds by id and symbol', async () => {
    const created = await createBitcoin();

    await expect(service.findOne(created.id)).resolves.toMatchObject({
      symbol: 'BTC',
    });
    await expect(service.findBySymbol('BTC')).resolves.toMatchObject({
      name: 'Bitcoin',
    });
  });

  it('throws a 404 for unknown ids and symbols', async () => {
    await expect(
      service.findOne('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findBySymbol('NOPE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('filters history by date range', async () => {
    const created = await service.create({
      name: 'Bitcoin',
      symbol: 'BTC',
      type: CurrencyType.CRYPTO,
      description: 'The first cryptocurrency.',
      historicalData: [
        { date: '2024-01-01', price: 42000 },
        { date: '2024-02-01', price: 43000 },
        { date: '2024-03-01', price: 44000 },
      ],
    });

    const history = await service.getFilteredHistory(
      created.id,
      '2024-01-15',
      '2024-02-28',
    );

    expect(history).toEqual([{ date: '2024-02-01', price: 43000 }]);
  });

  it('updates and deletes an entry', async () => {
    const created = await createBitcoin();

    const updated = await service.update(created.id, { name: 'Bitcoin Cash' });
    expect(updated.name).toBe('Bitcoin Cash');

    await expect(service.delete(created.id)).resolves.toEqual({
      message: 'Currency entry deleted successfully',
    });
    await expect(service.findOne(created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
