import { Controller, Post, Param, Get } from '@nestjs/common';
import { OrdersService } from './orders.service';
import * as crypto from 'crypto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post('/:seat_id/book')
  createBooking(@Param('seat_id') seatId: string) {
    const finalUserId = crypto.randomUUID();
    return this.ordersService.createBooking(finalUserId, seatId);
  }

  @Get('/:order_id')
  findOne(@Param('order_id') orderId: string) {
    return this.ordersService.findOne(orderId);
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }
}
