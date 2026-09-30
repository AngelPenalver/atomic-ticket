import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_GATEWAY } from '../ports/payment-gateway.interface';
import type { IPaymentGateway } from '../ports/payment-gateway.interface';
import { RESERVATION_PORT } from '../ports/reservation.port';
import type {
  IReservationPort,
  SettlementResult,
} from '../ports/reservation.port';

/** Confirma un pago recibido y lo reembolsa si la orden ya estaba cancelada. */
@Injectable()
export class ConfirmPaymentUseCase {
  private readonly logger = new Logger(ConfirmPaymentUseCase.name);

  constructor(
    @Inject(RESERVATION_PORT) private readonly reservations: IReservationPort,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
  ) {}

  async execute(
    orderId: string,
    externalId: string,
  ): Promise<SettlementResult> {
    const result = await this.reservations.markPaid(orderId, externalId);

    switch (result) {
      case 'settled':
        this.logger.log(
          `Order ${orderId} paid (checkout ${externalId}); seat sold`,
        );
        break;
      case 'already_settled':
        this.logger.log(
          `Order ${orderId} was already paid; duplicate notification ignored`,
        );
        break;
      case 'not_found':
        this.logger.error(
          `Payment ${externalId} received for unknown order ${orderId}`,
        );
        break;
      case 'conflict':
        this.logger.error(
          `Order ${orderId} was cancelled before payment ${externalId}; refunding`,
        );
        await this.paymentGateway.refund(externalId);
        break;
    }

    return result;
  }
}
