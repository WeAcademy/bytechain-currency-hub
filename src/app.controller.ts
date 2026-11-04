import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  health() {
    return {
      status: 'ok',
      service: 'bytechain-currency-hub',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe with a database check' })
  async ready() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ready' };
  }
}
