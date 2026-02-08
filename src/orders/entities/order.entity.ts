import { Seat } from "src/seats/entities/seat.entity";
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

export enum ORDER_STATUS {
    PENDING = 'pending',
    PAID = 'paid',
    CANCELLED = 'cancelled'
}

@Entity('order')
export class Order {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'enum', enum: ORDER_STATUS, default: ORDER_STATUS.PENDING })
    status: ORDER_STATUS;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ type: 'varchar', length: 3, default: 'USD' })
    currency: string;

    @Column({ type: 'timestamp' })
    expires_at: Date;

    @ManyToOne(() => Seat)
    @JoinColumn({ name: 'seat_id' })
    seat: Seat;

    @CreateDateColumn()
    created_at: Date;
}