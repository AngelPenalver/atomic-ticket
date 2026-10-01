import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './infrastructure/persistence/payment.entity';
import { PaymentController } from './infrastructure/controllers/payment.controller';
import { StripeWebhookController } from './infrastructure/controllers/stripe-webhook.controller';
import { ProcessPaymentUseCase } from './application/use-cases/process-payment.use-case';
import { CancelExpiredPaymentsUseCase } from './application/use-cases/cancel-expired-payments.use-case';
import { ConfirmPaymentUseCase } from './application/use-cases/confirm-payment.use-case';
import { CancelPaymentUseCase } from './application/use-cases/cancel-payment.use-case';
import { TypeOrmPaymentsRepository } from './infrastructure/persistence/typeorm-payments.repository';
import { TypeOrmReservationRepository } from './infrastructure/persistence/typeorm-reservation.repository';
import { StripeAdapter } from './infrastructure/gateways/stripe.adapter';
import { PaymentCleanupCron } from './infrastructure/schedulers/payment-cleanup.cron';
import { PAYMENT_REPOSITORY } from './domain/repositories/payment.repository.interface';
import { PAYMENT_GATEWAY } from './application/ports/payment-gateway.interface';
import { RESERVATION_PORT } from './application/ports/reservation.port';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity])],
  controllers: [PaymentController, StripeWebhookController],
  providers: [
    ProcessPaymentUseCase,
    ConfirmPaymentUseCase,
    CancelPaymentUseCase,
    CancelExpiredPaymentsUseCase,
    PaymentCleanupCron,
    {
      provide: PAYMENT_REPOSITORY,
      useClass: TypeOrmPaymentsRepository,
    },
    {
      provide: RESERVATION_PORT,
      useClass: TypeOrmReservationRepository,
    },
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new StripeAdapter({
          secretKey: config.getOrThrow<string>('STRIPE_SECRET_KEY'),
          webhookSecret: config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
          frontendUrl: config.getOrThrow<string>('FRONTEND_URL'),
        }),
    },
  ],
  exports: [ProcessPaymentUseCase],
})
export class PaymentsModule {}
