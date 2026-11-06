import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Protects write endpoints with a single deploy-time API key.
 *
 * Read endpoints stay public. This is intentionally simpler than the main
 * backend's JWT/roles setup: the currency hub has no user accounts.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_API_KEY');
    if (!expected) {
      throw new UnauthorizedException('Write API is not configured');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = request.headers['x-admin-api-key'];
    const provided = Array.isArray(header) ? header[0] : header;

    if (!provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid admin API key');
    }

    return true;
  }
}
