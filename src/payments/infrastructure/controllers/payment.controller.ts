import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ProcessPaymentUseCase } from 'src/payments/application/use-cases/process-payment.use-case';
import { CancelExpiredPaymentsUseCase } from 'src/payments/application/use-cases/cancel-expired-payments.use-case';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { CreatePaymentDto } from '../dtos/create-payment.dto';
import { PaymentExceptionFilter } from '../filters/payment-exception.filter';

@Controller('payments')
@UseFilters(PaymentExceptionFilter)
export class PaymentController {
  constructor(
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly cancelExpiredPaymentsUseCase: CancelExpiredPaymentsUseCase,
  ) {}

  /** Devuelve (o reintenta) el enlace de pago de una orden. */
  @Post('process')
  processPayment(@Body() dto: CreatePaymentDto) {
    return this.processPaymentUseCase.execute(dto.orderId);
  }

  /** Libera las reservas caducadas; pensado para Cloud Scheduler. */
  @Post('expire-reservations')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async expireReservations(): Promise<void> {
    await this.cancelExpiredPaymentsUseCase.execute();
  }
}
