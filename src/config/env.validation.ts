import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

/** Variables de entorno de la aplicación; `DATABASE_URL` sustituye a las `POSTGRES_*`. */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.DEVELOPMENT;

  @Type(() => Number)
  @IsInt()
  PORT: number = 3000;

  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  POSTGRES_HOST: string;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @Type(() => Number)
  @IsInt()
  POSTGRES_PORT: number = 5432;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  POSTGRES_USER: string;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  POSTGRES_PASSWORD: string;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  POSTGRES_DB: string;

  @IsString()
  @IsNotEmpty()
  STRIPE_SECRET_KEY: string;

  @IsString()
  @IsNotEmpty()
  STRIPE_WEBHOOK_SECRET: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL: string;

  @IsString()
  @MinLength(16)
  ADMIN_API_KEY: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  RESERVATION_TTL_MINUTES: number = 15;
}

/** Valida y tipa las variables de entorno; lanza un error si alguna es inválida. */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map(
        (error) =>
          `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
      )
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }

  return validated;
}
