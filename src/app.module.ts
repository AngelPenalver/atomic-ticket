import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventsModule } from './events/events.module';
import { SeatsModule } from './seats/seats.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { validateEnv } from './config/env.validation';
import { buildDatabaseOptions } from './database/database.options';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDatabaseOptions({
          DATABASE_URL: config.get<string>('DATABASE_URL'),
          POSTGRES_HOST: config.get<string>('POSTGRES_HOST'),
          POSTGRES_PORT: config.get<number>('POSTGRES_PORT'),
          POSTGRES_USER: config.get<string>('POSTGRES_USER'),
          POSTGRES_PASSWORD: config.get<string>('POSTGRES_PASSWORD'),
          POSTGRES_DB: config.get<string>('POSTGRES_DB'),
        }),
        autoLoadEntities: true,
      }),
    }),
    ScheduleModule.forRoot(),
    EventsModule,
    SeatsModule,
    OrdersModule,
    PaymentsModule,
  ],
})
export class AppModule {}
