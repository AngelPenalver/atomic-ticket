import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CheckoutUnavailableError,
  InvalidWebhookError,
  OrderAlreadyPaidError,
  OrderNotFoundError,
  OrderNotPayableError,
  PaymentError,
  PaymentGatewayError,
} from 'src/payments/domain/errors/payment.errors';

type PaymentErrorClass = abstract new (...args: any[]) => PaymentError;

const STATUS_BY_ERROR: [PaymentErrorClass, HttpStatus][] = [
  [OrderNotFoundError, HttpStatus.NOT_FOUND],
  [OrderAlreadyPaidError, HttpStatus.CONFLICT],
  [OrderNotPayableError, HttpStatus.CONFLICT],
  [CheckoutUnavailableError, HttpStatus.CONFLICT],
  [InvalidWebhookError, HttpStatus.BAD_REQUEST],
  [PaymentGatewayError, HttpStatus.BAD_GATEWAY],
];

/** Traduce los errores de pago del dominio a respuestas HTTP. */
@Catch(PaymentError)
export class PaymentExceptionFilter implements ExceptionFilter {
  catch(error: PaymentError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode =
      STATUS_BY_ERROR.find(
        ([errorClass]) => error instanceof errorClass,
      )?.[1] ?? HttpStatus.UNPROCESSABLE_ENTITY;

    response.status(statusCode).json({
      statusCode,
      message: error.message,
      error: error.name,
    });
  }
}
