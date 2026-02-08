import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Seat, STATUS_SEATS } from 'src/seats/entities/seat.entity';
import { Order, ORDER_STATUS } from './entities/order.entity';
import { ProcessPaymentUseCase } from 'src/payments/application/use-cases/process-payment.use-case';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly dataSource: DataSource, private readonly processPaymentUseCase: ProcessPaymentUseCase, @InjectRepository(Order) private readonly orderRepository: Repository<Order>) { }

  async createBooking(userId: string, seatId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedOrder: Order;

    try {
      const seat = await queryRunner.manager.findOne(Seat, {
        where: { id: seatId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!seat) throw new NotFoundException('Seat not found');
      if (seat.status !== STATUS_SEATS.AVAILABLE) throw new ConflictException('Seat is not available');

      seat.status = STATUS_SEATS.LOCKED;
      await queryRunner.manager.save(seat);

      const order = queryRunner.manager.create(Order, {
        user_id: userId,
        seat: seat,
        status: ORDER_STATUS.PENDING,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        amount: seat.price,
        currency: 'USD',
      });

      savedOrder = await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    try {
      this.logger.log('Attempting to process payment for order:', savedOrder.id);
      const payment = await this.processPaymentUseCase.execute(
        savedOrder.id,
      );

      return {
        checkoutUrl: payment.checkoutUrl,
        orderId: savedOrder.id,
      };
    } catch (error) {
      this.logger.error('Payment processing failed:', error);
      return {
        orderId: savedOrder.id,
        message: 'Order created but payment link failed. Please retry from your dashboard.',
        checkoutUrl: null
      };
    }
  }

  async findOne(id: string) {
    const order = await this.orderRepository.findOneBy({ id });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findAll() {
    return this.orderRepository.find();
  }
}
