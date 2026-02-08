import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CancelExpiredPaymentsUseCase } from 'src/payments/application/use-cases/cancel-expired-payments.use-case';

@Injectable()
export class PaymentCleanupCron {
    private readonly logger = new Logger(PaymentCleanupCron.name);

    constructor(
        private readonly cancelExpiredPaymentsUseCase: CancelExpiredPaymentsUseCase,
    ) { }

    @Cron('0 * * * *', { name: 'payment-cleanup' })
    async handleCron() {
        this.logger.log('Starting automatic cleanup of expired payments...');

        try {
            await this.cancelExpiredPaymentsUseCase.execute();
        } catch (error) {
            this.logger.error('Error in automatic cleanup process', error.stack);
        }
    }
}