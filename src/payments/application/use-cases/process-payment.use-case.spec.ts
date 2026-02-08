import { Test, TestingModule } from '@nestjs/testing';
import { ProcessPaymentUseCase } from './process-payment.use-case';
import type { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';
import type { IPaymentGateway } from '../ports/payment-gateway.interface';
import { Payment } from 'src/payments/domain/entities/payment.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from 'src/orders/entities/order.entity';

describe('ProcessPaymentUseCase', () => {
    let useCase: ProcessPaymentUseCase;
    let paymentRepository: IPaymentRepository;
    let paymentGateway: IPaymentGateway;
    let orderRepository: any;

    const mockPaymentRepository: IPaymentRepository = {
        save: jest.fn(),
        findById: jest.fn(),
        findByOrderId: jest.fn(),
        findExpiredPayments: jest.fn(),
        cancelAndReleaseSeat: jest.fn(),
        confirmAndFinalizeSeat: jest.fn(),
        cancelExpiredPayment: jest.fn(),
    };

    const mockPaymentGateway: IPaymentGateway = {
        createPayment: jest.fn(),
        getPaymentStatus: jest.fn(),
    };

    const mockOrderRepository = {
        findOneBy: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProcessPaymentUseCase,
                {
                    provide: 'IPaymentRepository',
                    useValue: mockPaymentRepository,
                },
                {
                    provide: 'IPaymentGateway',
                    useValue: mockPaymentGateway,
                },
                {
                    provide: getRepositoryToken(Order),
                    useValue: mockOrderRepository,
                },
            ],
        }).compile();

        useCase = module.get<ProcessPaymentUseCase>(ProcessPaymentUseCase);
        paymentRepository = module.get<IPaymentRepository>('IPaymentRepository');
        paymentGateway = module.get<IPaymentGateway>('IPaymentGateway');
        orderRepository = module.get(getRepositoryToken(Order));

        jest.clearAllMocks();
    });

    // Should create new payment and return checkout URL
    it('debe crear un nuevo pago y devolver el checkout URL', async () => {
        const orderId = 'order-123';
        const amount = 100;
        const currency = 'USD';

        const mockOrder = {
            id: orderId,
            amount,
            currency,
            status: 'pending',
        };

        (mockPaymentRepository.findByOrderId as jest.Mock).mockResolvedValue(null);
        (mockOrderRepository.findOneBy as jest.Mock).mockResolvedValue(mockOrder);

        const gatewayResponse = {
            externalId: 'stripe-payment-456',
            checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_123'
        };
        (mockPaymentGateway.createPayment as jest.Mock).mockResolvedValue(gatewayResponse);

        (mockPaymentRepository.save as jest.Mock).mockImplementation(async (payment) => payment);

        const result = await useCase.execute(orderId);

        expect(mockPaymentRepository.findByOrderId).toHaveBeenCalledWith(orderId);
        expect(mockOrderRepository.findOneBy).toHaveBeenCalledWith({ id: orderId });

        expect(mockPaymentRepository.save).toHaveBeenCalledTimes(2);

        expect(mockPaymentGateway.createPayment).toHaveBeenCalledWith(expect.any(Payment));

        expect(result).toEqual({
            paymentId: expect.any(String),
            checkoutUrl: gatewayResponse.checkoutUrl
        });
    });

    // Should use existing PENDING payment
    it('debe usar el pago existente si está PENDING', async () => {
        const orderId = 'order-456';
        const amount = 200;
        const currency = 'USD';

        const existingPayment = new Payment(
            'payment-789',
            amount,
            currency,
            'pending',
            orderId,
            new Date()
        );

        (mockPaymentRepository.findByOrderId as jest.Mock).mockResolvedValue(existingPayment);

        const gatewayResponse = {
            externalId: 'stripe-payment-999',
            checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_999'
        };
        (mockPaymentGateway.createPayment as jest.Mock).mockResolvedValue(gatewayResponse);
        (mockPaymentRepository.save as jest.Mock).mockImplementation(async (payment) => payment);

        const result = await useCase.execute(orderId);

        expect(mockPaymentRepository.findByOrderId).toHaveBeenCalledWith(orderId);

        expect(mockPaymentRepository.save).toHaveBeenCalledTimes(1);

        expect(mockPaymentGateway.createPayment).toHaveBeenCalled();

        expect(result).toEqual({
            paymentId: existingPayment.id,
            checkoutUrl: gatewayResponse.checkoutUrl
        });
    });

    // Should throw error if payment is already PAID
    it('debe lanzar error si el pago ya está PAID', async () => {
        const orderId = 'order-paid';
        const amount = 300;
        const currency = 'USD';

        const paidPayment = new Payment(
            'payment-paid',
            amount,
            currency,
            'PAID',
            orderId,
            new Date()
        );

        (mockPaymentRepository.findByOrderId as jest.Mock).mockResolvedValue(paidPayment);

        await expect(useCase.execute(orderId)).rejects.toThrow('This order is already paid');

        expect(mockPaymentGateway.createPayment).not.toHaveBeenCalled();

        expect(mockPaymentRepository.save).not.toHaveBeenCalled();
    });

    // Should rethrow error if gateway fails
    it('debe relanzar el error si el gateway falla', async () => {
        const orderId = 'order-gateway-fail';
        const amount = 150;
        const currency = 'USD';

        const mockOrder = {
            id: orderId,
            amount,
            currency,
            status: 'pending',
        };

        (mockPaymentRepository.findByOrderId as jest.Mock).mockResolvedValue(null);
        (mockOrderRepository.findOneBy as jest.Mock).mockResolvedValue(mockOrder);
        (mockPaymentRepository.save as jest.Mock).mockImplementation(async (payment) => payment);
        const gatewayError = new Error('Stripe API is down');
        (mockPaymentGateway.createPayment as jest.Mock).mockRejectedValue(gatewayError);

        await expect(useCase.execute(orderId)).rejects.toThrow('Stripe API is down');

        expect(mockPaymentGateway.createPayment).toHaveBeenCalled();
    });
});
