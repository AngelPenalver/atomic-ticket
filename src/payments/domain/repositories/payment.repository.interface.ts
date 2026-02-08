import { Payment } from "../entities/payment.entity";

export interface IPaymentRepository {
    save(payment: Payment): Promise<Payment>;
    findById(id: string): Promise<Payment | null>;
    findByOrderId(orderId: string): Promise<Payment | null>;
    findExpiredPayments(limitDate: Date): Promise<Payment[]>;
    cancelExpiredPayment(orderId: string): Promise<void>;
    confirmAndFinalizeSeat(orderId: string, externalId: string): Promise<void>;
    cancelAndReleaseSeat(orderId: string): Promise<void>;
}