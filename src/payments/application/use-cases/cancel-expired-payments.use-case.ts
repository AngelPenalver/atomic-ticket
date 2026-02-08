import { Inject, Logger } from "@nestjs/common";
import type { IPaymentRepository } from "src/payments/domain/repositories/payment.repository.interface";

export class CancelExpiredPaymentsUseCase {
    private readonly logger = new Logger(CancelExpiredPaymentsUseCase.name);
    constructor(
        @Inject('IPaymentRepository')
        private readonly paymentRepository: IPaymentRepository
    ) { }

    async execute(): Promise<void> {
        const expirationTime = new Date();
        expirationTime.setMinutes(expirationTime.getMinutes() - 10);

        const expiredPayments = await this.paymentRepository.findExpiredPayments(expirationTime);

        if (expiredPayments.length === 0) return;

        for (const payment of expiredPayments) {
            try {
                await this.paymentRepository.cancelExpiredPayment(payment.orderId);
                this.logger.warn(`Order ${payment.orderId} cancelled due to expiration.`);
            } catch (error) {
                this.logger.error(`Error cancelling order ${payment.orderId}:`, error);
            }
        }
    }
}