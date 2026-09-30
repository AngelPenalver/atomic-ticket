import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order, ORDER_STATUS } from './entities/order.entity';
import { Seat, STATUS_SEATS } from 'src/seats/entities/seat.entity';
import { ProcessPaymentUseCase } from 'src/payments/application/use-cases/process-payment.use-case';

const TTL_MINUTES = 15;

describe('OrdersService', () => {
  let service: OrdersService;

  const mockManager = {
    findOne: jest.fn(),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(
      (work: (manager: typeof mockManager) => Promise<unknown>) =>
        work(mockManager),
    ),
  };

  const mockProcessPaymentUseCase = {
    execute: jest.fn(),
  };

  const mockOrderRepository = {
    findOneBy: jest.fn(),
    find: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue(TTL_MINUTES),
  };

  const buildSeat = (status = STATUS_SEATS.AVAILABLE): Partial<Seat> => ({
    id: 'seat-456',
    status,
    price: 100,
    row: 'A',
    number: 5,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockManager.save.mockImplementation((entity: object) =>
      Promise.resolve(
        'user_id' in entity ? { ...entity, id: 'order-789' } : entity,
      ),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ProcessPaymentUseCase, useValue: mockProcessPaymentUseCase },
        { provide: getRepositoryToken(Order), useValue: mockOrderRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('createBooking', () => {
    it('should lock the seat, create a pending order and return the checkout URL', async () => {
      const seat = buildSeat();
      mockManager.findOne.mockResolvedValue(seat);
      mockProcessPaymentUseCase.execute.mockResolvedValue({
        paymentId: 'payment-123',
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
      });
      const before = Date.now();

      const result = await service.createBooking('user-123', 'seat-456');

      expect(mockManager.findOne).toHaveBeenCalledWith(Seat, {
        where: { id: 'seat-456' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(seat.status).toBe(STATUS_SEATS.LOCKED);
      expect(mockManager.save).toHaveBeenCalledWith(seat);
      expect(mockManager.create).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          user_id: 'user-123',
          seat_id: 'seat-456',
          status: ORDER_STATUS.PENDING,
          amount: 100,
          currency: 'USD',
        }),
      );

      const [, order] = mockManager.create.mock.calls[0] as [
        unknown,
        Partial<Order>,
      ];
      const ttlMs = order.expires_at!.getTime() - before;
      expect(ttlMs).toBeGreaterThanOrEqual(TTL_MINUTES * 60 * 1000);
      expect(ttlMs).toBeLessThan(TTL_MINUTES * 60 * 1000 + 5000);

      expect(mockProcessPaymentUseCase.execute).toHaveBeenCalledWith(
        'order-789',
      );
      expect(result).toEqual({
        orderId: 'order-789',
        checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123',
      });
    });

    it('should keep the order and return a null checkout URL when payment fails', async () => {
      mockManager.findOne.mockResolvedValue(buildSeat());
      mockProcessPaymentUseCase.execute.mockRejectedValue(
        new Error('Stripe down'),
      );

      const result = await service.createBooking('user-123', 'seat-456');

      expect(result).toMatchObject({ orderId: 'order-789', checkoutUrl: null });
      expect(result).toHaveProperty('message');
    });

    it('should throw NotFoundException if the seat does not exist', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.createBooking('user-123', 'seat-missing'),
      ).rejects.toThrow(NotFoundException);
      expect(mockManager.save).not.toHaveBeenCalled();
      expect(mockProcessPaymentUseCase.execute).not.toHaveBeenCalled();
    });

    it.each([STATUS_SEATS.LOCKED, STATUS_SEATS.SOLD])(
      'should throw ConflictException if the seat is %s',
      async (status) => {
        mockManager.findOne.mockResolvedValue(buildSeat(status));

        await expect(
          service.createBooking('user-123', 'seat-456'),
        ).rejects.toThrow(ConflictException);
        expect(mockManager.save).not.toHaveBeenCalled();
        expect(mockProcessPaymentUseCase.execute).not.toHaveBeenCalled();
      },
    );

    it('should propagate database errors and not request a payment', async () => {
      mockManager.findOne.mockResolvedValue(buildSeat());
      mockManager.save.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        service.createBooking('user-123', 'seat-456'),
      ).rejects.toThrow('Database connection lost');
      expect(mockProcessPaymentUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return the order', async () => {
      const order = { id: 'order-789' };
      mockOrderRepository.findOneBy.mockResolvedValue(order);

      await expect(service.findOne('order-789')).resolves.toBe(order);
    });

    it('should throw NotFoundException when the order does not exist', async () => {
      mockOrderRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        'Order not found',
      );
    });
  });

  it('findAll should list orders newest first', async () => {
    mockOrderRepository.find.mockResolvedValue([]);

    await service.findAll();

    expect(mockOrderRepository.find).toHaveBeenCalledWith({
      order: { created_at: 'DESC' },
    });
  });
});
