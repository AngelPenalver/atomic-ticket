import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateEventDto } from './dto/create-event.dto';
import { Event } from './entities/event.entity';
import { Seat } from 'src/seats/entities/seat.entity';

const SEATS_PER_ROW = 10;
const INSERT_CHUNK_SIZE = 1000;

/** Gestiona la creación y consulta de eventos. */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  /** Crea el evento y genera sus asientos en una única transacción. */
  async create(createEventDto: CreateEventDto) {
    const savedEvent = await this.dataSource.transaction(async (manager) => {
      const event = manager.create(Event, {
        name: createEventDto.name,
        description: createEventDto.description,
        date: createEventDto.date,
        total_tickets: createEventDto.total_tickets,
      });
      const saved = await manager.save(event);

      const seats = buildSeats(
        saved,
        createEventDto.total_tickets,
        createEventDto.price,
      );
      for (let i = 0; i < seats.length; i += INSERT_CHUNK_SIZE) {
        await manager.insert(Seat, seats.slice(i, i + INSERT_CHUNK_SIZE));
      }

      return saved;
    });

    this.logger.log(
      `Event ${savedEvent.id} created with ${createEventDto.total_tickets} seats`,
    );
    return savedEvent;
  }

  /** Devuelve un evento por id o lanza NotFoundException. */
  async findOne(id: string) {
    const event = await this.eventRepository.findOneBy({ id });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }
}

/** Genera los asientos del evento repartidos en filas de SEATS_PER_ROW. */
function buildSeats(
  event: Event,
  totalTickets: number,
  price: number,
): Partial<Seat>[] {
  return Array.from({ length: totalTickets }, (_, index) => ({
    event,
    row: rowLabel(Math.floor(index / SEATS_PER_ROW)),
    number: (index % SEATS_PER_ROW) + 1,
    price,
  }));
}

/** Convierte un índice de fila en su etiqueta: 0 → A, 25 → Z, 26 → AA. */
function rowLabel(rowIndex: number): string {
  let label = '';
  for (let n = rowIndex + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}
