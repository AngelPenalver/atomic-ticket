import { Payment as DomainPayment } from "src/payments/domain/entities/payment.entity";
import { PAYMENT_STATUS, PaymentEntity } from "../persistence/payment.entity";

export class PaymentMapper {
    static toDomain(entity: PaymentEntity): DomainPayment {
        return new DomainPayment(
            entity.id,
            Number(entity.amount),
            entity.currency,
            entity.status,
            entity.orderId,
            entity.createdAt,
        );
    }

    static toPersistence(domain: DomainPayment): PaymentEntity {
        const entity = new PaymentEntity();
        entity.id = domain.id;
        entity.amount = domain.amount;
        entity.currency = domain.currency;
        entity.status = domain.status as PAYMENT_STATUS;
        entity.orderId = domain.orderId;
        entity.externalId = domain.externalId;
        entity.createdAt = domain.createdAt;
        return entity;
    }
}