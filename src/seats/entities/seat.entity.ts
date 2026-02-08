import { Event } from "src/events/entities/event.entity";
import { Order } from "src/orders/entities/order.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Unique, VersionColumn } from "typeorm";

export enum STATUS_SEATS {
    AVAILABLE = 'available',
    LOCKED = 'locked',
    SOLD = 'sold',
}

@Entity('seat')
@Unique(['event', 'row', 'number'])
export class Seat {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Event, (event) => event.seats)
    @JoinColumn({ name: 'event_id' })
    event: Event;

    @Column({ type: 'varchar', length: 10 })
    row: string;

    @Column({ type: 'int' })
    number: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: number;

    @Column({ type: 'enum', enum: STATUS_SEATS, default: STATUS_SEATS.AVAILABLE })
    status: STATUS_SEATS;

    @OneToOne(() => Order, (order) => order.seat, { nullable: true })
    active_order: Order;

    @VersionColumn()
    version: number;
}