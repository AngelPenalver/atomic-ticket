import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

/** Arranca la aplicación con validación global y prefijo `api/v1`. */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://0.0.0.0:${port}`);
}
void bootstrap();
