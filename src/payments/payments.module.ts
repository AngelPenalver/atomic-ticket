import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentEntity } from "./infrastructure/persistence/payment.entity";
import { PaymentController } from "./infrastructure/controllers/payment.controller";
import { StripeWebhookController } from "./infrastructure/controllers/stripe-webhook.controller";
import { ProcessPaymentUseCase } from "./application/use-cases/process-payment.use-case";
import { CancelExpiredPaymentsUseCase } from "./application/use-cases/cancel-expired-payments.use-case";
import { ConfirmPaymentUseCase } from "./application/use-cases/confirm-payment.use-case";
import { CancelPaymentUseCase } from "./application/use-cases/cancel-payment.use-case";
import { TypeOrmPaymentsRepository } from "./infrastructure/persistence/typeorm-payments.repository";
import { StripeAdapter } from "./infrastructure/gateways/stripe.adapter";
import { PaymentCleanupCron } from "./domain/schedulers/payment-cleanup.cron";
import { Order } from "src/orders/entities/order.entity";

@Module({
    imports: [TypeOrmModule.forFeature([PaymentEntity]), TypeOrmModule.forFeature([Order])],
    controllers: [PaymentController, StripeWebhookController],
    providers: [
        ProcessPaymentUseCase,
        ConfirmPaymentUseCase,
        CancelPaymentUseCase,
        CancelExpiredPaymentsUseCase,
        PaymentCleanupCron,
        {
            provide: 'IPaymentRepository',
            useClass: TypeOrmPaymentsRepository,
        },
        {
            provide: 'IPaymentGateway',
            useFactory: () => {
                return new StripeAdapter(process.env.STRIPE_SECRET_KEY || '');
            },
        },
    ],
    exports: [ProcessPaymentUseCase],
})
export class PaymentsModule { }