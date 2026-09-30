import { Seat } from 'src/seats/entities/seat.entity';
import { decimalTransformer } from 'src/common/transformers/decimal.transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ORDER_STATUS {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

@Entity('order')
@Index(['status', 'expires_at'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'enum', enum: ORDER_STATUS, default: ORDER_STATUS.PENDING })
  status: ORDER_STATUS;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'uuid' })
  seat_id: string;

  @ManyToOne(() => Seat, { nullable: false })
  @JoinColumn({ name: 'seat_id' })
  seat: Seat;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
