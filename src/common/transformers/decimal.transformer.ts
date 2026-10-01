import type { ValueTransformer } from 'typeorm';

/** Convierte las columnas `decimal` de Postgres (string) a number. */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : Number(value),
};
