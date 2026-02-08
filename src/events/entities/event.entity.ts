import { Seat } from "src/seats/entities/seat.entity";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('event')
export class Event {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToMany(() => Seat, (seat) => seat.event)
    seats: Seat[];

    @Column({ type: 'varchar', length: 50 })
    name: string;

    @Column({ type: 'varchar', length: 255 })
    description: string;

    @Column({ type: 'timestamp' })
    date: Date;

    @Column({ type: 'int' })
    total_tickets: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
