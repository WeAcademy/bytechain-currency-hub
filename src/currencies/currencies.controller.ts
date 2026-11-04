import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import {
  CreateCurrencyDto,
  UpdateCurrencyDto,
} from './dto/create-currency.dto';
import { CurrencyType } from './entities/currency-entry.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Currencies Hub')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'List all currencies with optional filters' })
  @ApiQuery({ name: 'type', enum: CurrencyType, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  async findAll(
    @Query('type') type?: CurrencyType,
    @Query('search') search?: string,
    @Query() paginationDto?: PaginationDto,
  ) {
    return this.currenciesService.findAll(type, search, paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single currency entry by ID with full history',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.currenciesService.findOne(id);
  }

  @Get('symbol/:symbol')
  @ApiOperation({ summary: 'Get a single currency entry by ticker symbol' })
  async findBySymbol(@Param('symbol') symbol: string) {
    return this.currenciesService.findBySymbol(symbol);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get filtered historical data for a currency' })
  @ApiQuery({
    name: 'from',
    type: String,
    required: false,
    description: 'YYYY-MM-DD',
  })
  @ApiQuery({
    name: 'to',
    type: String,
    required: false,
    description: 'YYYY-MM-DD',
  })
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.currenciesService.getFilteredHistory(id, from, to);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new currency entry' })
  async create(@Body() createCurrencyDto: CreateCurrencyDto) {
    return this.currenciesService.create(createCurrencyDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing currency entry' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCurrencyDto: UpdateCurrencyDto,
  ) {
    return this.currenciesService.update(id, updateCurrencyDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a currency entry' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.currenciesService.delete(id);
  }
}
