import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { DataSource } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Seat, STATUS_SEATS } from 'src/seats/entities/seat.entity';
import { Order, ORDER_STATUS } from './entities/order.entity';
import { ProcessPaymentUseCase } from 'src/payments/application/use-cases/process-payment.use-case';

describe('OrdersService', () => {
    let service: OrdersService;
    let dataSource: DataSource;
    let processPaymentUseCase: ProcessPaymentUseCase;

    const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
        },
    };

    const mockDataSource = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const mockProcessPaymentUseCase = {
        execute: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OrdersService,
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                },
                {
                    provide: ProcessPaymentUseCase,
                    useValue: mockProcessPaymentUseCase,
                },
            ],
        }).compile();

        service = module.get<OrdersService>(OrdersService);
        dataSource = module.get<DataSource>(DataSource);
        processPaymentUseCase = module.get<ProcessPaymentUseCase>(ProcessPaymentUseCase);

        jest.clearAllMocks();
    });

    it('You should successfully create a booking when the seat is available', async () => {
        const userId = 'user-123';
        const seatId = 'seat-456';

        const mockSeat: Partial<Seat> = {
            id: seatId,
            status: STATUS_SEATS.AVAILABLE,
            price: 100,
            row: 'A',
            number: 5,
        };

        const mockOrder: Partial<Order> = {
            id: 'order-789',
            user_id: userId,
            seat: mockSeat as Seat,
            status: ORDER_STATUS.PENDING,
            expires_at: new Date(Date.now() + 10 * 60 * 1000),
        };

        (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockSeat);

        (mockQueryRunner.manager.save as jest.Mock).mockImplementation(async (entity) => {
            return entity;
        });

        (mockQueryRunner.manager.create as jest.Mock).mockReturnValue(mockOrder);

        (mockProcessPaymentUseCase.execute as jest.Mock).mockResolvedValue({
            paymentId: 'payment-123',
            checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123'
        });

        const result = await service.createBooking(userId, seatId);

        expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
        expect(mockQueryRunner.connect).toHaveBeenCalled();
        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(Seat, {
            where: { id: seatId },
            lock: { mode: 'pessimistic_write' },
        });

        expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(mockSeat);
        expect(mockSeat.status).toBe(STATUS_SEATS.LOCKED);

        expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(Order, {
            user_id: userId,
            seat: mockSeat,
            status: ORDER_STATUS.PENDING,
            expires_at: expect.any(Date),
            amount: mockSeat.price,
            currency: 'USD',
        });

        expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(mockOrder);

        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();

        expect(mockQueryRunner.release).toHaveBeenCalled();
        expect(result).toEqual({
            checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
            orderId: mockOrder.id
        });
    });

    it('You should throw a NotFoundException if the seat does not exist', async () => {
        const userId = 'user-123';
        const seatId = 'seat-inexistente';

        (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(null);

        await expect(service.createBooking(userId, seatId)).rejects.toThrow(NotFoundException);
        await expect(service.createBooking(userId, seatId)).rejects.toThrow('Seat not found');

        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.manager.findOne).toHaveBeenCalled();

        expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();

        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();

        expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('You should throw a ConflictException if the seat is not available', async () => {
        const userId = 'user-123';
        const seatId = 'seat-456';

        const mockSeat: Partial<Seat> = {
            id: seatId,
            status: STATUS_SEATS.LOCKED,
            price: 100,
        };

        (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockSeat);

        await expect(service.createBooking(userId, seatId)).rejects.toThrow(ConflictException);
        await expect(service.createBooking(userId, seatId)).rejects.toThrow('Seat is not available');

        expect(mockQueryRunner.manager.findOne).toHaveBeenCalled();

        expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();

        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();

        expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('You should roll back if an unexpected error occurs during saving', async () => {
        const userId = 'user-123';
        const seatId = 'seat-456';

        const mockSeat: Partial<Seat> = {
            id: seatId,
            status: STATUS_SEATS.AVAILABLE,
            price: 100,
        };

        (mockQueryRunner.manager.findOne as jest.Mock).mockResolvedValue(mockSeat);

        const dbError = new Error('Database connection lost');
        (mockQueryRunner.manager.save as jest.Mock).mockRejectedValue(dbError);

        await expect(service.createBooking(userId, seatId)).rejects.toThrow('Database connection lost');

        expect(mockQueryRunner.manager.save).toHaveBeenCalled();

        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();

        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();

        expect(mockQueryRunner.release).toHaveBeenCalled();
    });
});
