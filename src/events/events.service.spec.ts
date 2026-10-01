import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { Event } from './entities/event.entity';
import { Seat } from 'src/seats/entities/seat.entity';

describe('EventsService', () => {
  let service: EventsService;

  const mockManager = {
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn(),
    insert: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(
      (work: (manager: typeof mockManager) => Promise<unknown>) =>
        work(mockManager),
    ),
  };

  const mockEventRepository = {
    findOneBy: jest.fn(),
  };

  const buildDto = (
    overrides: Partial<CreateEventDto> = {},
  ): CreateEventDto => ({
    name: 'Concierto Rock',
    description: 'El mejor concierto',
    date: new Date('2026-12-31T20:00:00Z'),
    total_tickets: 20,
    price: 100,
    ...overrides,
  });

  /** Todos los asientos pasados a manager.insert, sumando todos los lotes. */
  const insertedSeats = (): Partial<Seat>[] =>
    mockManager.insert.mock.calls.flatMap(
      ([, seats]: [unknown, Partial<Seat>[]]) => seats,
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    mockManager.save.mockImplementation((event: object) =>
      Promise.resolve({ ...event, id: 'event-1' }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Event), useValue: mockEventRepository },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('create', () => {
    it('should create the event and its seats inside one transaction', async () => {
      const dto = buildDto();

      const result = await service.create(dto);

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockManager.create).toHaveBeenCalledWith(Event, {
        name: dto.name,
        description: dto.description,
        date: dto.date,
        total_tickets: dto.total_tickets,
      });
      expect(result).toMatchObject({ id: 'event-1', name: dto.name });

      const seats = insertedSeats();
      expect(seats).toHaveLength(20);
      expect(seats[0]).toMatchObject({ row: 'A', number: 1, price: 100 });
      expect(seats[9]).toMatchObject({ row: 'A', number: 10 });
      expect(seats[10]).toMatchObject({ row: 'B', number: 1 });
      expect(seats.every((seat) => seat.event === result)).toBe(true);
    });

    it('should create exactly total_tickets seats when the last row is partial', async () => {
      await service.create(buildDto({ total_tickets: 13 }));

      const seats = insertedSeats();
      expect(seats).toHaveLength(13);
      expect(seats[12]).toMatchObject({ row: 'B', number: 3 });
    });

    it('should label rows past Z as AA, AB...', async () => {
      await service.create(buildDto({ total_tickets: 275 }));

      const rows = [...new Set(insertedSeats().map((seat) => seat.row))];
      expect(rows).toHaveLength(28);
      expect(rows.slice(24)).toEqual(['Y', 'Z', 'AA', 'AB']);
    });

    it('should insert seats in chunks of 1000', async () => {
      await service.create(buildDto({ total_tickets: 2500 }));

      const chunkSizes = mockManager.insert.mock.calls.map(
        ([, seats]: [unknown, unknown[]]) => seats.length,
      );
      expect(chunkSizes).toEqual([1000, 1000, 500]);
    });

    it('should propagate database errors so the transaction rolls back', async () => {
      mockManager.save.mockRejectedValue(new Error('Error in database'));

      await expect(service.create(buildDto())).rejects.toThrow(
        'Error in database',
      );
      expect(mockManager.insert).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return the event', async () => {
      const event = { id: 'event-1', name: 'Concierto Rock' };
      mockEventRepository.findOneBy.mockResolvedValue(event);

      await expect(service.findOne('event-1')).resolves.toBe(event);
    });

    it('should throw NotFoundException when the event does not exist', async () => {
      mockEventRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
