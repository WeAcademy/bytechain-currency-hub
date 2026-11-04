import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CurrenciesModule } from './currencies/currencies.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
      validate: (env: Record<string, string>) => {
        const required = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'];
        const missing = required.filter((key) => !env[key]);
        if (missing.length > 0) {
          throw new Error(
            `Missing required environment variables: ${missing.join(', ')}`,
          );
        }
        return {
          ...env,
          DB_PORT: env.DB_PORT || '5432',
          PORT: env.PORT || '3002',
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        synchronize: false,
        autoLoadEntities: true,
        migrationsRun: true,
      }),
    }),
    ScheduleModule.forRoot(),
    CurrenciesModule,
  ],
})
export class AppModule {}
