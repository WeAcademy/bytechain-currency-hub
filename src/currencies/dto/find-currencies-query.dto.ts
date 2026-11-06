import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrencyType } from '../entities/currency-entry.entity';

export class FindCurrenciesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CurrencyType })
  @IsOptional()
  @IsEnum(CurrencyType)
  type?: CurrencyType;

  @ApiPropertyOptional({ example: 'bitcoin', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
