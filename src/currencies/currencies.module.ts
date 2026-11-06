import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { CurrencyEntry } from './entities/currency-entry.entity';
import { CurrenciesSeedService } from './seeds/currencies.seed';

@Module({
  imports: [TypeOrmModule.forFeature([CurrencyEntry])],
  controllers: [CurrenciesController],
  providers: [CurrenciesService, CurrenciesSeedService, AdminApiKeyGuard],
})
export class CurrenciesModule {}
