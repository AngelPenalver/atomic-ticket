import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, LessThan } from 'typeorm';
import type {
  ExpiredReservation,
  IReservationPort,
  ReservationSnapshot,
  SettlementResult,
} from 'src/payments/application/ports/reservation.port';
import { PaymentStatus } from 'src/payments/domain/entities/payment.entity';
import { Order, ORDER_STATUS } from 'src/orders/entities/order.entity';
import { Seat, STATUS_SEATS } from 'src/seats/entities/seat.entity';
import { PaymentEntity } from './payment.entity';

/** Implementación TypeORM de IReservationPort. */
@Injectable()
export class TypeOrmReservationRepository implements IReservationPort {
  constructor(private readonly dataSource: DataSource) {}

  async findOrder(orderId: string): Promise<ReservationSnapshot | null> {
    const order = await this.dataSource
      .getRepository(Order)
      .findOneBy({ id: orderId });
    if (!order) return null;

    return {
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      expiresAt: order.expires_at,
    };
  }

  async findExpiredPendingOrders(
    now: Date,
    limit: number,
  ): Promise<ExpiredReservation[]> {
    const orders = await this.dataSource.getRepository(Order).find({
      select: { id: true },
      where: { status: ORDER_STATUS.PENDING, expires_at: LessThan(now) },
      order: { expires_at: 'ASC' },
      take: limit,
    });
    if (orders.length === 0) return [];

    const payments = await this.dataSource.getRepository(PaymentEntity).find({
      select: { orderId: true, externalId: true },
      where: { orderId: In(orders.map((order) => order.id)) },
    });
    const externalIds = new Map(
      payments.map((payment) => [payment.orderId, payment.externalId]),
    );

    return orders.map((order) => ({
      orderId: order.id,
      externalId: externalIds.get(order.id) ?? undefined,
    }));
  }

  markPaid(orderId: string, externalId: string): Promise<SettlementResult> {
    return this.settle(orderId, ORDER_STATUS.PAID, async (manager, order) => {
      await manager.update(
        PaymentEntity,
        { orderId },
        { status: PaymentStatus.PAID, externalId },
      );
      await manager.update(
        Order,
        { id: orderId },
        { status: ORDER_STATUS.PAID },
      );
      await manager.update(
        Seat,
        { id: order.seat_id },
        { status: STATUS_SEATS.SOLD },
      );
    });
  }

  release(orderId: string): Promise<SettlementResult> {
    return this.settle(
      orderId,
      ORDER_STATUS.CANCELLED,
      async (manager, order) => {
        await manager.update(
          PaymentEntity,
          { orderId },
          { status: PaymentStatus.CANCELLED },
        );
        await manager.update(
          Order,
          { id: orderId },
          { status: ORDER_STATUS.CANCELLED },
        );
        await manager.update(
          Seat,
          { id: order.seat_id, status: STATUS_SEATS.LOCKED },
          { status: STATUS_SEATS.AVAILABLE },
        );
      },
    );
  }

  /**
   * Locks the order row so concurrent webhooks and the expiration job serialize,
   * and only applies the transition while the order is still pending.
   */
  private settle(
    orderId: string,
    target: ORDER_STATUS,
    apply: (manager: EntityManager, order: Order) => Promise<void>,
  ): Promise<SettlementResult> {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) return 'not_found';
      if (order.status === target) return 'already_settled';
      if (order.status !== ORDER_STATUS.PENDING) return 'conflict';

      await apply(manager, order);
      return 'settled';
    });
  }
}
