import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OrdersService } from './orders.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** Reserva un asiento y devuelve el enlace de pago. */
  @Post('/:seat_id/book')
  createBooking(
    @Param('seat_id', ParseUUIDPipe) seatId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.ordersService.createBooking(
      dto.user_id ?? randomUUID(),
      seatId,
    );
  }

  /** Devuelve el detalle de una orden. */
  @Get('/:order_id')
  findOne(@Param('order_id', ParseUUIDPipe) orderId: string) {
    return this.ordersService.findOne(orderId);
  }

  /** Lista todas las órdenes (requiere API key). */
  @Get()
  @UseGuards(ApiKeyGuard)
  findAll() {
    return this.ordersService.findAll();
  }
}
