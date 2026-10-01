import { Inject, Injectable, Logger } from '@nestjs/common';
import { Payment } from 'src/payments/domain/entities/payment.entity';
import {
  CheckoutUnavailableError,
  OrderAlreadyPaidError,
  OrderNotFoundError,
  OrderNotPayableError,
} from 'src/payments/domain/errors/payment.errors';
import { PAYMENT_REPOSITORY } from 'src/payments/domain/repositories/payment.repository.interface';
import type { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';
import { PAYMENT_GATEWAY } from '../ports/payment-gateway.interface';
import type { IPaymentGateway } from '../ports/payment-gateway.interface';
import { RESERVATION_PORT } from '../ports/reservation.port';
import type { IReservationPort } from '../ports/reservation.port';

export interface ProcessPaymentResult {
  paymentId: string;
  checkoutUrl: string;
}

/** Obtiene o crea el checkout de una orden pendiente. */
@Injectable()
export class ProcessPaymentUseCase {
  private readonly logger = new Logger(ProcessPaymentUseCase.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: IPaymentRepository,
    @Inject(RESERVATION_PORT) private readonly reservations: IReservationPort,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
  ) {}

  async execute(orderId: string): Promise<ProcessPaymentResult> {
    this.logger.log(`Processing payment for order: ${orderId}`);

    const order = await this.reservations.findOrder(orderId);
    if (!order) throw new OrderNotFoundError(orderId);
    if (order.status === 'paid') throw new OrderAlreadyPaidError(orderId);
    if (order.status !== 'pending' || order.expiresAt <= new Date()) {
      throw new OrderNotPayableError(orderId);
    }

    const payment = await this.paymentRepository.createIfAbsent(
      Payment.create({
        orderId,
        amount: order.amount,
        currency: order.currency,
      }),
    );

    if (payment.hasCheckout()) {
      return {
        paymentId: payment.id,
        checkoutUrl: await this.resumeCheckout(orderId, payment.externalId),
      };
    }

    const checkout = await this.paymentGateway.createCheckout({
      orderId,
      amount: order.amount,
      currency: order.currency,
      expiresAt: order.expiresAt,
    });

    const attached = await this.paymentRepository.attachExternalId(
      payment.id,
      checkout.externalId,
    );
    if (!attached) {
      await this.paymentGateway.expireCheckout(checkout.externalId);
      const current = await this.paymentRepository.findByOrderId(orderId);
      if (!current?.hasCheckout()) throw new CheckoutUnavailableError(orderId);
      return {
        paymentId: current.id,
        checkoutUrl: await this.resumeCheckout(orderId, current.externalId),
      };
    }

    this.logger.log(
      `Checkout ${checkout.externalId} created for order: ${orderId}`,
    );
    return { paymentId: payment.id, checkoutUrl: checkout.checkoutUrl };
  }

  /** Devuelve la URL de un checkout existente si sigue abierto. */
  private async resumeCheckout(
    orderId: string,
    externalId: string,
  ): Promise<string> {
    const checkout = await this.paymentGateway.getCheckout(externalId);

    if (checkout.status === 'complete')
      throw new OrderAlreadyPaidError(orderId);
    if (checkout.status !== 'open' || !checkout.checkoutUrl)
      throw new CheckoutUnavailableError(orderId);

    return checkout.checkoutUrl;
  }
}
