import { Payment } from '../entities/payment.entity';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

/** Repositorio de pagos. */
export interface IPaymentRepository {
  /** Busca el pago de una orden. */
  findByOrderId(orderId: string): Promise<Payment | null>;
  /** Inserta el pago si la orden aún no tiene uno y devuelve el guardado. */
  createIfAbsent(payment: Payment): Promise<Payment>;
  /** Asocia el id externo solo si no tenía uno; devuelve false si otro se adelantó. */
  attachExternalId(paymentId: string, externalId: string): Promise<boolean>;
}
