import { Payment as DomainPayment } from 'src/payments/domain/entities/payment.entity';
import { PaymentEntity } from '../persistence/payment.entity';

/** Convierte entre la entidad de dominio Payment y su entidad de persistencia. */
export class PaymentMapper {
  static toDomain(entity: PaymentEntity): DomainPayment {
    return new DomainPayment(
      entity.id,
      entity.amount,
      entity.currency,
      entity.status,
      entity.orderId,
      entity.createdAt,
      entity.externalId ?? undefined,
    );
  }

  static toPersistence(domain: DomainPayment): PaymentEntity {
    const entity = new PaymentEntity();
    entity.id = domain.id;
    entity.amount = domain.amount;
    entity.currency = domain.currency;
    entity.status = domain.status;
    entity.orderId = domain.orderId;
    entity.externalId = domain.externalId ?? null;
    entity.createdAt = domain.createdAt;
    return entity;
  }
}
