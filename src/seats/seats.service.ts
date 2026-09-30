import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seat } from './entities/seat.entity';
import { EventsService } from 'src/events/events.service';

/** Consulta de asientos. */
@Injectable()
export class SeatsService {
  private readonly logger = new Logger(SeatsService.name);

  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    private readonly eventService: EventsService,
  ) {}

  /** Lista los asientos de un evento ordenados por fila y número. */
  async findByEventId(eventId: string) {
    await this.eventService.findOne(eventId);

    const seats = await this.seatRepository
      .createQueryBuilder('seat')
      .where('seat.event_id = :eventId', { eventId })
      .orderBy('LENGTH(seat.row)', 'ASC')
      .addOrderBy('seat.row', 'ASC')
      .addOrderBy('seat.number', 'ASC')
      .getMany();

    if (seats.length === 0) {
      this.logger.warn(`No seats found for event: ${eventId}`);
    }

    return { seats };
  }

  /** Devuelve un asiento por id o lanza NotFoundException. */
  async findOne(id: string) {
    const seat = await this.seatRepository.findOneBy({ id });
    if (!seat) throw new NotFoundException('Seat not found');
    return seat;
  }
}
