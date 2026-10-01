import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { SeatsService } from './seats.service';

@Controller('seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  /** Lista los asientos de un evento. */
  @Get('/event/:event_id')
  findByEventId(@Param('event_id', ParseUUIDPipe) eventId: string) {
    return this.seatsService.findByEventId(eventId);
  }

  /** Devuelve el detalle de un asiento. */
  @Get('/:seat_id')
  findOne(@Param('seat_id', ParseUUIDPipe) seatId: string) {
    return this.seatsService.findOne(seatId);
  }
}
