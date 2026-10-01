import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { PaymentStatus } from 'src/payments/domain/entities/payment.entity';
import { decimalTransformer } from 'src/common/transformers/decimal.transformer';

@Entity('payment')
@Unique(['orderId'])
@Index(['status', 'createdAt'])
export class PaymentEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
