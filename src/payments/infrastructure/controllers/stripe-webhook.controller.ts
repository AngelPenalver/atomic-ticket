import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PAYMENT_GATEWAY } from 'src/payments/application/ports/payment-gateway.interface';
import type { IPaymentGateway } from 'src/payments/application/ports/payment-gateway.interface';
import { ConfirmPaymentUseCase } from 'src/payments/application/use-cases/confirm-payment.use-case';
import { CancelPaymentUseCase } from 'src/payments/application/use-cases/cancel-payment.use-case';
import { PaymentExceptionFilter } from '../filters/payment-exception.filter';

@Controller('webhooks')
@UseFilters(PaymentExceptionFilter)
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    private readonly cancelPaymentUseCase: CancelPaymentUseCase,
  ) {}

  /** Recibe y procesa los webhooks firmados de Stripe. */
  @Post('stripe')
  @HttpCode(200)
  async handleStripe(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing signature or request body');
    }

    const event = this.paymentGateway.parseWebhookEvent(req.rawBody, signature);

    if (event.type === 'ignored') {
      this.logger.log(`Event not handled: ${event.name}`);
      return { received: true };
    }

    if (!event.orderId) {
      this.logger.error(
        `Stripe session ${event.externalId} has no orderId metadata`,
      );
      return { received: true };
    }

    if (event.type === 'checkout.paid') {
      await this.confirmPaymentUseCase.execute(event.orderId, event.externalId);
    } else {
      await this.cancelPaymentUseCase.execute(event.orderId, event.externalId);
    }

    return { received: true };
  }
}
