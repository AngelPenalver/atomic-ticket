import { Test, TestingModule } from '@nestjs/testing';
import { SeatsService } from './seats.service';
import { Repository } from 'typeorm';
import { Seat } from './entities/seat.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from 'src/events/events.service';

describe('SeatsService', () => {
    let service: SeatsService;
    let repository: Repository<Seat>;

    const mockSeatRepository = {
        find: jest.fn(),
    };

    const mockEventsService = {
        findOne: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SeatsService,
                {
                    provide: getRepositoryToken(Seat),
                    useValue: mockSeatRepository,
                },
                {
                    provide: EventsService,
                    useValue: mockEventsService,
                },
            ],
        }).compile();

        service = module.get<SeatsService>(SeatsService);
        repository = module.get<Repository<Seat>>(getRepositoryToken(Seat));

        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findByEventId', () => {
        it('should return seats for a valid event ID', async () => {
            const eventId = 'test-event-id';
            const mockSeats = [
                { id: '1', row: 'A', number: 1, price: 50, status: 'available' },
                { id: '2', row: 'A', number: 2, price: 50, status: 'available' },
            ];

            mockEventsService.findOne.mockResolvedValue({ id: eventId, name: 'Test Event' });
            mockSeatRepository.find.mockResolvedValue(mockSeats);

            const result = await service.findByEventId(eventId);

            expect(result).toEqual({ seats: mockSeats });
            expect(mockEventsService.findOne).toHaveBeenCalledWith(eventId);
            expect(mockSeatRepository.find).toHaveBeenCalledWith({
                where: { event: { id: eventId } },
                order: { row: 'ASC', number: 'ASC' },
            });
        });

        it('should return empty array when no seats found', async () => {
            const eventId = 'non-existent-event';
            mockEventsService.findOne.mockResolvedValue({ id: eventId, name: 'Test Event' });
            mockSeatRepository.find.mockResolvedValue([]);

            const result = await service.findByEventId(eventId);

            expect(result).toEqual({ seats: [] });
        });
    });
});
