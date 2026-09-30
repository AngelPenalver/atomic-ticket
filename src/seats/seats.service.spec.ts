import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeatsService } from './seats.service';
import { Seat } from './entities/seat.entity';
import { EventsService } from 'src/events/events.service';

describe('SeatsService', () => {
  let service: SeatsService;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockSeatRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOneBy: jest.fn(),
  };

  const mockEventsService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatsService,
        { provide: getRepositoryToken(Seat), useValue: mockSeatRepository },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<SeatsService>(SeatsService);
  });

  describe('findByEventId', () => {
    it('should return the seats of the event sorted by row and number', async () => {
      const eventId = 'test-event-id';
      const mockSeats = [
        { id: '1', row: 'A', number: 1, price: 50, status: 'available' },
        { id: '2', row: 'A', number: 2, price: 50, status: 'available' },
      ];
      mockEventsService.findOne.mockResolvedValue({ id: eventId });
      queryBuilder.getMany.mockResolvedValue(mockSeats);

      const result = await service.findByEventId(eventId);

      expect(result).toEqual({ seats: mockSeats });
      expect(mockEventsService.findOne).toHaveBeenCalledWith(eventId);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'seat.event_id = :eventId',
        { eventId },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'LENGTH(seat.row)',
        'ASC',
      );
      expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(
        1,
        'seat.row',
        'ASC',
      );
      expect(queryBuilder.addOrderBy).toHaveBeenNthCalledWith(
        2,
        'seat.number',
        'ASC',
      );
    });

    it('should return an empty array when the event has no seats', async () => {
      mockEventsService.findOne.mockResolvedValue({ id: 'event-id' });
      queryBuilder.getMany.mockResolvedValue([]);

      await expect(service.findByEventId('event-id')).resolves.toEqual({
        seats: [],
      });
    });

    it('should propagate NotFoundException when the event does not exist', async () => {
      mockEventsService.findOne.mockRejectedValue(
        new NotFoundException('Event with ID missing not found'),
      );

      await expect(service.findByEventId('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSeatRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return the seat', async () => {
      const seat = { id: 'seat-1', row: 'A', number: 1 };
      mockSeatRepository.findOneBy.mockResolvedValue(seat);

      await expect(service.findOne('seat-1')).resolves.toBe(seat);
      expect(mockSeatRepository.findOneBy).toHaveBeenCalledWith({
        id: 'seat-1',
      });
    });

    it('should throw NotFoundException when the seat does not exist', async () => {
      mockSeatRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        'Seat not found',
      );
    });
  });
});
