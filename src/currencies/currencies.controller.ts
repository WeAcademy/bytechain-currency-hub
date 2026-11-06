import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { CurrenciesService } from './currencies.service';
import {
  CreateCurrencyDto,
  UpdateCurrencyDto,
} from './dto/create-currency.dto';
import { FindCurrenciesQueryDto } from './dto/find-currencies-query.dto';

@ApiTags('Currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'List currencies with optional filters' })
  findAll(@Query() query: FindCurrenciesQueryDto) {
    return this.currenciesService.findAll(query.type, query.search, query);
  }

  @Get('symbol/:symbol')
  @ApiOperation({ summary: 'Look up a currency by ticker symbol' })
  findBySymbol(@Param('symbol') symbol: string) {
    return this.currenciesService.findBySymbol(symbol.toUpperCase());
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get price history filtered by date' })
  @ApiQuery({ name: 'from', required: false, example: '2024-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2024-12-31' })
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.currenciesService.getFilteredHistory(id, from, to);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a currency with its full history' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.currenciesService.findOne(id);
  }

  @Post()
  @UseGuards(AdminApiKeyGuard)
  @ApiSecurity('admin-api-key')
  @ApiOperation({ summary: 'Create a currency (admin only)' })
  create(@Body() createCurrencyDto: CreateCurrencyDto) {
    return this.currenciesService.create(createCurrencyDto);
  }

  @Patch(':id')
  @UseGuards(AdminApiKeyGuard)
  @ApiSecurity('admin-api-key')
  @ApiOperation({ summary: 'Update a currency (admin only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCurrencyDto: UpdateCurrencyDto,
  ) {
    return this.currenciesService.update(id, updateCurrencyDto);
  }

  @Delete(':id')
  @UseGuards(AdminApiKeyGuard)
  @ApiSecurity('admin-api-key')
  @ApiOperation({ summary: 'Delete a currency (admin only)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.currenciesService.delete(id);
  }
}
