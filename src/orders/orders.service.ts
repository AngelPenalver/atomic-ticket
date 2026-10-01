import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Seat, STATUS_SEATS } from 'src/seats/entities/seat.entity';
import { Order, ORDER_STATUS } from './entities/order.entity';
import { ProcessPaymentUseCase } from 'src/payments/application/use-cases/process-payment.use-case';

const DEFAULT_CURRENCY = 'USD';

/** Gestiona las reservas de asientos y la consulta de órdenes. */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly reservationTtlMs: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    configService: ConfigService,
  ) {
    this.reservationTtlMs =
      configService.getOrThrow<number>('RESERVATION_TTL_MINUTES') * 60 * 1000;
  }

  /** Bloquea el asiento, crea la orden pendiente y solicita el enlace de pago. */
  async createBooking(userId: string, seatId: string) {
    const order = await this.reserveSeat(userId, seatId);

    try {
      const payment = await this.processPaymentUseCase.execute(order.id);
      return { orderId: order.id, checkoutUrl: payment.checkoutUrl };
    } catch (error) {
      this.logger.error(
        `Payment link failed for order ${order.id}`,
        error instanceof Error ? error.stack : error,
      );
      return {
        orderId: order.id,
        checkoutUrl: null,
        message:
          'Order created but payment link failed. Retry with POST /payments/process.',
      };
    }
  }

  /** Devuelve una orden por id o lanza NotFoundException. */
  async findOne(id: string) {
    const order = await this.orderRepository.findOneBy({ id });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Lista las órdenes, de la más reciente a la más antigua. */
  findAll() {
    return this.orderRepository.find({ order: { created_at: 'DESC' } });
  }

  /** Bloquea el asiento (SELECT FOR UPDATE) y crea la orden en una transacción. */
  private reserveSeat(userId: string, seatId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const seat = await manager.findOne(Seat, {
        where: { id: seatId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!seat) throw new NotFoundException('Seat not found');
      if (seat.status !== STATUS_SEATS.AVAILABLE)
        throw new ConflictException('Seat is not available');

      seat.status = STATUS_SEATS.LOCKED;
      await manager.save(seat);

      const order = manager.create(Order, {
        user_id: userId,
        seat_id: seat.id,
        status: ORDER_STATUS.PENDING,
        expires_at: new Date(Date.now() + this.reservationTtlMs),
        amount: seat.price,
        currency: DEFAULT_CURRENCY,
      });

      const saved = await manager.save(order);
      this.logger.log(`Seat ${seat.id} locked for order ${saved.id}`);
      return saved;
    });
  }
}
