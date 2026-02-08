import { Inject, Injectable, Logger } from "@nestjs/common";
import type { IPaymentRepository } from "src/payments/domain/repositories/payment.repository.interface";

@Injectable()
export class CancelPaymentUseCase {
    private readonly logger = new Logger(CancelPaymentUseCase.name);

    constructor(
        @Inject('IPaymentRepository')
        private readonly paymentRepository: IPaymentRepository
    ) { }

    async execute(orderId: string): Promise<void> {
        this.logger.log(`Cancelling payment for order: ${orderId}`);
        await this.paymentRepository.cancelAndReleaseSeat(orderId);
        this.logger.log(`Payment cancelled successfully for order: ${orderId}`);
    }
}