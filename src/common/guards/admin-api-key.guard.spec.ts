import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminApiKeyGuard } from './admin-api-key.guard';

function context(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminApiKeyGuard', () => {
  const config = {
    get: jest.fn<string | undefined, [string]>(),
  } as unknown as ConfigService;

  beforeEach(() => {
    (config.get as jest.Mock).mockReset();
  });

  it('rejects requests when no write key is configured', () => {
    (config.get as jest.Mock).mockReturnValue(undefined);
    const guard = new AdminApiKeyGuard(config);

    expect(() =>
      guard.canActivate(context({ 'x-admin-api-key': 'anything' })),
    ).toThrow(UnauthorizedException);
  });

  it('rejects missing and incorrect keys', () => {
    (config.get as jest.Mock).mockReturnValue('secret-key');
    const guard = new AdminApiKeyGuard(config);

    expect(() => guard.canActivate(context({}))).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(context({ 'x-admin-api-key': 'wrong' })),
    ).toThrow(UnauthorizedException);
  });

  it('accepts the configured key', () => {
    (config.get as jest.Mock).mockReturnValue('secret-key');
    const guard = new AdminApiKeyGuard(config);

    expect(
      guard.canActivate(context({ 'x-admin-api-key': 'secret-key' })),
    ).toBe(true);
  });
});
