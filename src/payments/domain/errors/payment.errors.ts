/** Error base del módulo de pagos. */
export abstract class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class OrderNotFoundError extends PaymentError {
  constructor(orderId: string) {
    super(`Order ${orderId} not found`);
  }
}

export class OrderAlreadyPaidError extends PaymentError {
  constructor(orderId: string) {
    super(`Order ${orderId} is already paid`);
  }
}

export class OrderNotPayableError extends PaymentError {
  constructor(orderId: string) {
    super(
      `Order ${orderId} has expired or was cancelled; create a new booking`,
    );
  }
}

export class CheckoutUnavailableError extends PaymentError {
  constructor(orderId: string) {
    super(`The checkout session for order ${orderId} is no longer available`);
  }
}

export class InvalidWebhookError extends PaymentError {
  constructor(reason: string) {
    super(`Invalid webhook: ${reason}`);
  }
}

/** Fallo del proveedor de pagos; el detalle se registra en logs, no se expone. */
export class PaymentGatewayError extends PaymentError {
  constructor(
    operation: string,
    public readonly cause?: unknown,
  ) {
    super(`Payment provider error during ${operation}`);
  }
}
