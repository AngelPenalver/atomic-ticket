import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

export enum PAYMENT_STATUS {
    PENDING = 'pending',
    PAID = 'paid',
    CANCELLED = 'cancelled'
}

@Entity('payment')
@Unique(['orderId'])
@Index(['status', 'createdAt'])
export class PaymentEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ type: 'varchar', length: 3 })
    currency: string;

    @Column({ type: 'enum', enum: PAYMENT_STATUS, default: PAYMENT_STATUS.PENDING })
    status: PAYMENT_STATUS;

    @Column({ type: 'varchar', length: 36 })
    orderId: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    externalId?: string;

    @Column({ type: 'timestamp' })
    createdAt: Date;
}