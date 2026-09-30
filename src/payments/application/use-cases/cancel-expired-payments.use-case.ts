import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_GATEWAY } from '../ports/payment-gateway.interface';
import type { IPaymentGateway } from '../ports/payment-gateway.interface';
import { RESERVATION_PORT } from '../ports/reservation.port';
import type { IReservationPort } from '../ports/reservation.port';

const BATCH_SIZE = 100;

/** Libera las reservas caducadas, cerrando antes su checkout. */
@Injectable()
export class CancelExpiredPaymentsUseCase {
  private readonly logger = new Logger(CancelExpiredPaymentsUseCase.name);

  constructor(
    @Inject(RESERVATION_PORT) private readonly reservations: IReservationPort,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
  ) {}

  async execute(now = new Date()): Promise<void> {
    const expired = await this.reservations.findExpiredPendingOrders(
      now,
      BATCH_SIZE,
    );

    for (const { orderId, externalId } of expired) {
      try {
        if (
          externalId &&
          (await this.paymentGateway.expireCheckout(externalId)) === 'completed'
        ) {
          await this.reservations.markPaid(orderId, externalId);
          this.logger.log(
            `Order ${orderId} was paid before expiring; confirmed`,
          );
          continue;
        }

        const result = await this.reservations.release(orderId);
        if (result === 'settled') {
          this.logger.warn(`Order ${orderId} cancelled due to expiration`);
        }
      } catch (error) {
        this.logger.error(
          `Error cancelling order ${orderId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }
}
