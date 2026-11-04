import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { buildDatabaseOptions } from './database/database-options';
import { CurrenciesModule } from './currencies/currencies.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDatabaseOptions({
          NODE_ENV: config.get<string>('NODE_ENV'),
          DATABASE_URL: config.get<string>('DATABASE_URL'),
          DATABASE_PATH: config.get<string>('DATABASE_PATH'),
          DB_SYNCHRONIZE: config.get<string>('DB_SYNCHRONIZE'),
          DB_LOGGING: config.get<string>('DB_LOGGING'),
          DB_SSL: config.get<string>('DB_SSL'),
        }),
        autoLoadEntities: true,
      }),
    }),
    CurrenciesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
