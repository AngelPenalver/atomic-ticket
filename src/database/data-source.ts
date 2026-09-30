import { existsSync } from 'fs';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from './database.options';
import { Event } from '../events/entities/event.entity';
import { Seat } from '../seats/entities/seat.entity';
import { Order } from '../orders/entities/order.entity';
import { PaymentEntity } from '../payments/infrastructure/persistence/payment.entity';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

/** DataSource usado por el CLI de TypeORM para generar y ejecutar migraciones. */
export default new DataSource({
  ...buildDatabaseOptions({
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_DB: process.env.POSTGRES_DB,
  }),
  entities: [Event, Seat, Order, PaymentEntity],
  migrationsRun: false,
});
