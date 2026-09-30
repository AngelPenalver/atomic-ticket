import { randomUUID } from 'crypto';

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

/** Pago de una orden. */
export class Payment {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly status: PaymentStatus,
    public readonly orderId: string,
    public readonly createdAt: Date,
    public readonly externalId?: string,
  ) {}

  /** Crea un pago pendiente con un id nuevo. */
  static create(params: {
    orderId: string;
    amount: number;
    currency: string;
  }): Payment {
    return new Payment(
      randomUUID(),
      params.amount,
      params.currency,
      PaymentStatus.PENDING,
      params.orderId,
      new Date(),
    );
  }

  /** Indica si el pago ya tiene una sesión de checkout asociada. */
  hasCheckout(): this is Payment & { externalId: string } {
    return this.externalId !== undefined;
  }
}
