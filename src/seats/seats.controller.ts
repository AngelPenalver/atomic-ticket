import { Controller, Get, Param } from '@nestjs/common';
import { SeatsService } from './seats.service';

@Controller('seats')
export class SeatsController {
    constructor(private readonly seatsService: SeatsService) { }

    @Get('/event/:event_id')
    findByEventId(@Param('event_id') eventId: string) {
        return this.seatsService.findByEventId(eventId);
    }

    @Get('/:seat_id')
    findOne(@Param('seat_id') seatId: string) {
        return this.seatsService.findOne(seatId);
    }
}
