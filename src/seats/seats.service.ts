import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seat } from './entities/seat.entity';
import { Event } from 'src/events/entities/event.entity';
import { EventsService } from 'src/events/events.service';

@Injectable()
export class SeatsService {
    private readonly logger = new Logger(SeatsService.name);

    constructor(
        @InjectRepository(Seat)
        private readonly seatRepository: Repository<Seat>,
        private readonly eventService: EventsService,
    ) { }

    async findByEventId(eventId: string) {
        this.logger.log(`Fetching seats for event: ${eventId}`);

        const event = await this.eventService.findOne(eventId);

        if (!event) {
            throw new NotFoundException(`Event with ID ${eventId} not found`);
        }

        const seats = await this.seatRepository.find({
            where: { event: { id: eventId } },
            order: { row: 'ASC', number: 'ASC' },
        });

        if (seats.length === 0) {
            this.logger.warn(`No seats found for event: ${eventId}`);
        }

        return { seats };
    }

    async findOne(id: string) {
        const seat = await this.seatRepository.findOneBy({ id });
        if (!seat) throw new NotFoundException('Seat not found');
        return seat;
    }
}
