import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyEntry } from '../entities/currency-entry.entity';
import { seedCurrencies } from './seed-currencies';

@Injectable()
export class CurrenciesSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CurrenciesSeedService.name);

  constructor(
    @InjectRepository(CurrencyEntry)
    private readonly repository: Repository<CurrencyEntry>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const configured = this.config.get<string>('SEED_ON_STARTUP');
    const enabled =
      configured === undefined
        ? this.config.get<string>('NODE_ENV') !== 'production'
        : configured === 'true';

    if (!enabled) {
      return;
    }

    const result = await seedCurrencies(this.repository);
    this.logger.log(
      `Currency seed complete: ${result.created} created, ${result.skipped} skipped`,
    );
  }
}
