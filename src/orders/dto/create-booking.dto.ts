import { IsOptional, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsOptional()
  @IsUUID()
  user_id?: string;
}
