import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { DataSource } from 'typeorm';
import { CreateEventDto } from './dto/create-event.dto';
import { Event } from './entities/event.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('EventsService', () => {
    let service: EventsService;
    let dataSource: DataSource;

    const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
            save: jest.fn(),
            insert: jest.fn(),
        },
    };

    const mockDataSource = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const mockEventRepository = {
        findOneBy: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventsService,
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                },
                {
                    provide: getRepositoryToken(Event),
                    useValue: mockEventRepository,
                },
            ],
        }).compile();

        service = module.get<EventsService>(EventsService);
        dataSource = module.get<DataSource>(DataSource);

        jest.clearAllMocks();
    });

    it('You must create an event and generate its correct seats', async () => {
        const createEventDto: CreateEventDto = {
            name: 'Concierto Rock',
            description: 'El mejor concierto',
            date: new Date(),
            total_tickets: 20,
            price: 100,
        };

        (mockQueryRunner.manager.save as jest.Mock).mockImplementation(async (entity) => {
            entity.id = '1';
            return entity;
        });

        const result = await service.create(createEventDto);

        expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
        expect(mockQueryRunner.connect).toHaveBeenCalled();
        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(expect.any(Event));

        expect(mockQueryRunner.manager.insert).toHaveBeenCalled();

        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();

        expect(mockQueryRunner.release).toHaveBeenCalled();

        expect(result).toMatchObject({
            id: '1',
            name: createEventDto.name,
            total_tickets: createEventDto.total_tickets
        });
    });

    it('You must rollback the transaction if an error occurs', async () => {
        const createEventDto: CreateEventDto = {
            name: 'Evento Fallido',
            description: 'Error test',
            date: new Date(),
            total_tickets: 10,
            price: 50,
        };

        const errorSimulado = new Error('Error in database');
        (mockQueryRunner.manager.save as jest.Mock).mockRejectedValue(errorSimulado);

        await expect(service.create(createEventDto)).rejects.toThrow('Error in database');

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();

        expect(mockQueryRunner.release).toHaveBeenCalled();
    });
});
