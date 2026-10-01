import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /** Crea un evento con sus asientos (requiere API key). */
  @Post()
  @UseGuards(ApiKeyGuard)
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }
}
