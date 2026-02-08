import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import { NotFoundException } from '@nestjs/common';
import type { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';
import { Payment } from 'src/payments/domain/entities/payment.entity';

describe('ConfirmPaymentUseCase', () => {
    let useCase: ConfirmPaymentUseCase;
    let paymentRepository: IPaymentRepository;

    const mockPaymentRepository: IPaymentRepository = {
        save: jest.fn(),
        findById: jest.fn(),
        findByOrderId: jest.fn(),
        findExpiredPayments: jest.fn(),
        cancelAndReleaseSeat: jest.fn(),
        confirmAndFinalizeSeat: jest.fn(),
        cancelExpiredPayment: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ConfirmPaymentUseCase,
                {
                    provide: 'IPaymentRepository',
                    useValue: mockPaymentRepository,
                },
            ],
        }).compile();

        useCase = module.get<ConfirmPaymentUseCase>(ConfirmPaymentUseCase);
        paymentRepository = module.get<IPaymentRepository>('IPaymentRepository');

        jest.clearAllMocks();
    });

    // Should confirm payment successfully when it exists and has externalId
    it('debe confirmar el pago exitosamente cuando existe', async () => {
        const orderId = 'order-123';
        const stripeSessionId = 'stripe-session-456';

        const mockPayment = new Payment(
            'payment-456',
            100,
            'USD',
            'PENDING',
            orderId,
            new Date()
        );

        (mockPaymentRepository.findByOrderId as jest.Mock).mockResolvedValue(mockPayment);
        (mockPaymentRepository.confirmAndFinalizeSeat as jest.Mock).mockResolvedValue(undefined);

        const result = await useCase.execute(orderId, stripeSessionId);

        expect(mockPaymentRepository.findByOrderId).toHaveBeenCalledWith(orderId);
        expect(mockPaymentRepository.findByOrderId).toHaveBeenCalledTimes(1);
        expect(mockPaymentRepository.confirmAndFinalizeSeat).toHaveBeenCalledWith(orderId, stripeSessionId);
        expect(mockPaymentRepository.confirmAndFinalizeSeat).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            message: 'Payment confirmed successfully',
            orderId,
            externalId: stripeSessionId
        });
    });

    // Should throw NotFoundException when payment does not exist
    it('debe lanzar NotFoundException cuando el pago no existe', async () => {
        const orderId = 'order-inexistente';
        const stripeSessionId = 'stripe-session-999';

        (mockPaymentRepository.findByOrderId as jest.Mock).mockResolvedValue(null);

        await expect(useCase.execute(orderId, stripeSessionId)).rejects.toThrow(NotFoundException);
        await expect(useCase.execute(orderId, stripeSessionId)).rejects.toThrow(`No se encontró un registro de pago para la orden: ${orderId}`);

        expect(mockPaymentRepository.findByOrderId).toHaveBeenCalledWith(orderId);
        expect(mockPaymentRepository.confirmAndFinalizeSeat).not.toHaveBeenCalled();
    });



    // Should rethrow error if repository fails to confirm
    it('debe relanzar el error si el repositorio falla al confirmar', async () => {
        const orderId = 'order-789';
        const stripeSessionId = 'stripe-session-789';

        const mockPayment = new Payment(
            'payment-999',
            50,
            'USD',
            'PENDING',
            orderId,
            new Date()
        );

        (mockPaymentRepository.findByOrderId as jest.Mock).mockResolvedValue(mockPayment);

        const repositoryError = new Error('Database connection lost');
        (mockPaymentRepository.confirmAndFinalizeSeat as jest.Mock).mockRejectedValue(repositoryError);

        await expect(useCase.execute(orderId, stripeSessionId)).rejects.toThrow('Database connection lost');

        expect(mockPaymentRepository.confirmAndFinalizeSeat).toHaveBeenCalledWith(orderId, stripeSessionId);
    });
});
