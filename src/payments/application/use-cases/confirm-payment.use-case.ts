import { BadRequestException, Inject, Logger, NotFoundException } from "@nestjs/common";
import type { IPaymentRepository } from "src/payments/domain/repositories/payment.repository.interface";

export class ConfirmPaymentUseCase {
    private readonly logger = new Logger(ConfirmPaymentUseCase.name);

    constructor(
        @Inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
    ) { }

    async execute(orderId: string, stripeSessionId: string) { // <--- Recibimos el ID de Stripe
        this.logger.log(`Confirming payment for order: ${orderId} with session: ${stripeSessionId}`);

        const payment = await this.paymentRepository.findByOrderId(orderId);

        if (!payment) {
            this.logger.error(`Payment not found for order: ${orderId}`);
            throw new NotFoundException(`No se encontró un registro de pago para la orden: ${orderId}`);
        }

        await this.paymentRepository.confirmAndFinalizeSeat(orderId, stripeSessionId);

        this.logger.log(`Payment confirmed successfully for order: ${orderId}`);

        return {
            message: 'Payment confirmed successfully',
            orderId,
            externalId: stripeSessionId
        };
    }
}