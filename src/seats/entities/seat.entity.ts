import { Event } from 'src/events/entities/event.entity';
import { decimalTransformer } from 'src/common/transformers/decimal.transformer';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  VersionColumn,
} from 'typeorm';

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

  @ManyToOne(() => Event, (event) => event.seats, { nullable: false })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'varchar', length: 10 })
  row: string;

  @Column({ type: 'int' })
  number: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  @Column({ type: 'enum', enum: STATUS_SEATS, default: STATUS_SEATS.AVAILABLE })
  status: STATUS_SEATS;

  @VersionColumn()
  version: number;
}
