import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';
import { Payment } from 'src/payments/domain/entities/payment.entity';
import { PaymentEntity } from './payment.entity';
import { PaymentMapper } from '../mappers/payment.mapper';

/** Implementación TypeORM de IPaymentRepository. */
@Injectable()
export class TypeOrmPaymentsRepository implements IPaymentRepository {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repository: Repository<PaymentEntity>,
  ) {}

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const entity = await this.repository.findOne({ where: { orderId } });
    return entity ? PaymentMapper.toDomain(entity) : null;
  }

  async createIfAbsent(payment: Payment): Promise<Payment> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .values(PaymentMapper.toPersistence(payment))
      .orIgnore()
      .execute();

    const stored = await this.findByOrderId(payment.orderId);
    if (!stored)
      throw new Error(
        `Payment for order ${payment.orderId} could not be stored`,
      );
    return stored;
  }

  async attachExternalId(
    paymentId: string,
    externalId: string,
  ): Promise<boolean> {
    const result = await this.repository.update(
      { id: paymentId, externalId: IsNull() },
      { externalId },
    );
    return result.affected === 1;
  }
}
