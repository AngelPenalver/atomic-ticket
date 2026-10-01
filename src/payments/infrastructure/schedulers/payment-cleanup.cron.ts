import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CancelExpiredPaymentsUseCase } from 'src/payments/application/use-cases/cancel-expired-payments.use-case';

/** Ejecuta cada minuto la liberación de reservas caducadas. */
@Injectable()
export class PaymentCleanupCron {
  private readonly logger = new Logger(PaymentCleanupCron.name);
  private running = false;

  constructor(
    private readonly cancelExpiredPaymentsUseCase: CancelExpiredPaymentsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'payment-cleanup' })
  async handleCron() {
    if (this.running) return;
    this.running = true;

    try {
      await this.cancelExpiredPaymentsUseCase.execute();
    } catch (error) {
      this.logger.error(
        'Error in automatic cleanup process',
        error instanceof Error ? error.stack : error,
      );
    } finally {
      this.running = false;
    }
  }
}
