import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'crypto';

export const API_KEY_HEADER = 'x-api-key';

/** Protege endpoints de administración exigiendo la API key en la cabecera `x-api-key`. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expectedDigest: Buffer;

  constructor(configService: ConfigService) {
    this.expectedDigest = digest(
      configService.getOrThrow<string>('ADMIN_API_KEY'),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header(API_KEY_HEADER);

    if (!provided || !timingSafeEqual(digest(provided), this.expectedDigest)) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}

/** Calcula el SHA-256 de un valor para compararlo en tiempo constante. */
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
