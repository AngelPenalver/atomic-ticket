import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateEventDto } from './dto/create-event.dto';
import { Event } from './entities/event.entity';
import { Seat } from 'src/seats/entities/seat.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) { }

  async create(createEventDto: CreateEventDto) {

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()


    try {

      const totalTickets = createEventDto.total_tickets;
      const seatsPerRow = 10;
      const totalRows = Math.ceil(totalTickets / seatsPerRow);

      let seadCounter = 0;


      const event = new Event();
      event.name = createEventDto.name;
      event.description = createEventDto.description;
      event.date = createEventDto.date;
      event.total_tickets = createEventDto.total_tickets;

      const savedEvent = await queryRunner.manager.save(event);

      const seats: Seat[] = [];
      for (let row = 1; row <= totalRows; row++) {
        const rowLabel = String.fromCharCode(64 + row);

        for (let number = 1; number <= seatsPerRow; number++) {
          if (seadCounter >= totalTickets) break;

          const seat = new Seat();
          seat.row = rowLabel;
          seat.number = number;
          seat.price = createEventDto.price;
          seat.event = savedEvent;

          seats.push(seat);
          seadCounter++;
        }
      }

      while (seats.length > 0) {
        const chunk = seats.splice(0, 1000);
        await queryRunner.manager.insert(Seat, chunk);
      }

      await queryRunner.commitTransaction();
      return event;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

  }

  async findOne(id: string) {
    const event = await this.eventRepository.findOneBy({ id });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }
}
