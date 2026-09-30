import { join } from 'path';
import type { DataSourceOptions } from 'typeorm';

type DatabaseEnv = {
  DATABASE_URL?: string;
  POSTGRES_HOST?: string;
  POSTGRES_PORT?: number | string;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_DB?: string;
};

/** Construye las opciones de conexión compartidas por la app y el CLI de TypeORM. */
export function buildDatabaseOptions(env: DatabaseEnv): DataSourceOptions {
  const connection = env.DATABASE_URL
    ? { url: env.DATABASE_URL }
    : {
        host: env.POSTGRES_HOST,
        port: Number(env.POSTGRES_PORT ?? 5432),
        username: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        database: env.POSTGRES_DB,
      };

  return {
    type: 'postgres',
    ...connection,
    synchronize: false,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsRun: true,
  };
}
