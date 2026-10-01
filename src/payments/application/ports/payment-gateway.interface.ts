export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CreateCheckoutInput {
  orderId: string;
  amount: number;
  currency: string;
  expiresAt: Date;
}

export interface Checkout {
  externalId: string;
  status: 'open' | 'complete' | 'expired';
  checkoutUrl: string | null;
}

/** Evento de webhook traducido a términos del dominio. */
export type PaymentWebhookEvent =
  | { type: 'checkout.paid'; externalId: string; orderId?: string }
  | { type: 'checkout.expired'; externalId: string; orderId?: string }
  | { type: 'ignored'; name: string };

/** Puerto hacia el proveedor de pagos. */
export interface IPaymentGateway {
  /** Crea una sesión de pago y devuelve su id externo y URL. */
  createCheckout(
    input: CreateCheckoutInput,
  ): Promise<{ externalId: string; checkoutUrl: string }>;
  /** Consulta el estado de una sesión de pago. */
  getCheckout(externalId: string): Promise<Checkout>;
  /** Cierra un checkout abierto para que ya no se pueda pagar. */
  expireCheckout(externalId: string): Promise<'expired' | 'completed'>;
  /** Reembolsa el pago asociado a una sesión. */
  refund(externalId: string): Promise<void>;
  /** Verifica la firma y traduce el evento del proveedor; lanza InvalidWebhookError. */
  parseWebhookEvent(rawBody: Buffer, signature: string): PaymentWebhookEvent;
}
