import { Payment } from "../../domain/entities/payment.entity";

export interface IPaymentGateway {
    createPayment(payment: Payment): Promise<{ externalId: string; checkoutUrl: string }>;
    getPaymentStatus(externalId: string): Promise<string>;
}   