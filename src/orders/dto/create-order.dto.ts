import { IsNotEmpty, IsString } from "class-validator";

export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    seat_id: string;

}
