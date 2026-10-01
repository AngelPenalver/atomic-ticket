export const RESERVATION_PORT = Symbol('RESERVATION_PORT');

export interface ReservationSnapshot {
  orderId: string;
  status: 'pending' | 'paid' | 'cancelled';
  amount: number;
  currency: string;
  expiresAt: Date;
}

export interface ExpiredReservation {
  orderId: string;
  externalId?: string;
}

/** Resultado de intentar una transición de estado sobre una orden. */
export type SettlementResult =
  | 'settled'
  | 'already_settled'
  | 'conflict'
  | 'not_found';

/** Puerto para las transiciones atómicas de orden, asiento y pago. */
export interface IReservationPort {
  /** Devuelve el estado de una orden o null si no existe. */
  findOrder(orderId: string): Promise<ReservationSnapshot | null>;
  /** Devuelve las órdenes pendientes cuya reserva ya caducó. */
  findExpiredPendingOrders(
    now: Date,
    limit: number,
  ): Promise<ExpiredReservation[]>;
  /** Marca la orden como pagada y el asiento como vendido. */
  markPaid(orderId: string, externalId: string): Promise<SettlementResult>;
  /** Cancela la orden y libera el asiento. */
  release(orderId: string): Promise<SettlementResult>;
}
