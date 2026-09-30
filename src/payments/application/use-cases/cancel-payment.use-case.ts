import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_REPOSITORY } from 'src/payments/domain/repositories/payment.repository.interface';
import type { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';
import { RESERVATION_PORT } from '../ports/reservation.port';
import type {
  IReservationPort,
  SettlementResult,
} from '../ports/reservation.port';

/** Cancela una reserva cuando expira su checkout en el proveedor. */
@Injectable()
export class CancelPaymentUseCase {
  private readonly logger = new Logger(CancelPaymentUseCase.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: IPaymentRepository,
    @Inject(RESERVATION_PORT) private readonly reservations: IReservationPort,
  ) {}

  async execute(
    orderId: string,
    externalId: string,
  ): Promise<SettlementResult | 'stale'> {
    const payment = await this.paymentRepository.findByOrderId(orderId);

    if (payment?.externalId !== externalId) {
      this.logger.log(
        `Ignoring expiration of stale checkout ${externalId} for order ${orderId}`,
      );
      return 'stale';
    }

    const result = await this.reservations.release(orderId);
    this.logger.log(
      `Checkout ${externalId} expired for order ${orderId}: ${result}`,
    );
    return result;
  }
}
