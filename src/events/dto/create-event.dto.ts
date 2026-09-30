import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_TICKETS_PER_EVENT = 10_000;
/** Importe mínimo que Stripe acepta en un cobro con tarjeta (USD). */
export const MIN_TICKET_PRICE = 0.5;

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsInt()
  @Min(1)
  @Max(MAX_TICKETS_PER_EVENT)
  total_tickets: number;

  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(MIN_TICKET_PRICE)
  price: number;
}
