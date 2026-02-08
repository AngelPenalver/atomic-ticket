import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateEventDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsDate()
    @Type(() => Date)
    date: Date;

    @IsNumber()
    @IsNotEmpty()
    total_tickets: number;

    @IsNumber()
    @IsNotEmpty()
    price: number;
}
