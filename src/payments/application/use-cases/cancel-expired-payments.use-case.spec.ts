import { Test, TestingModule } from '@nestjs/testing';
import { CancelExpiredPaymentsUseCase } from './cancel-expired-payments.use-case';
import type { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';
import { Payment } from 'src/payments/domain/entities/payment.entity';

describe('CancelExpiredPaymentsUseCase', () => {
    let useCase: CancelExpiredPaymentsUseCase;
    let paymentRepository: IPaymentRepository;

    const mockPaymentRepository: IPaymentRepository = {
        save: jest.fn(),
        findById: jest.fn(),
        findByOrderId: jest.fn(),
        findExpiredPayments: jest.fn(),
        cancelExpiredPayment: jest.fn(),
        cancelAndReleaseSeat: jest.fn(),
        confirmAndFinalizeSeat: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CancelExpiredPaymentsUseCase,
                {
                    provide: 'IPaymentRepository',
                    useValue: mockPaymentRepository,
                },
            ],
        }).compile();

        useCase = module.get<CancelExpiredPaymentsUseCase>(CancelExpiredPaymentsUseCase);
        paymentRepository = module.get<IPaymentRepository>('IPaymentRepository');

        jest.clearAllMocks();
    });

    // Should do nothing if there are no expired payments
    it('debe terminar sin hacer nada si no hay pagos expirados', async () => {
        (mockPaymentRepository.findExpiredPayments as jest.Mock).mockResolvedValue([]);

        await useCase.execute();

        expect(mockPaymentRepository.findExpiredPayments).toHaveBeenCalledWith(expect.any(Date));
        expect(mockPaymentRepository.findExpiredPayments).toHaveBeenCalledTimes(1);
        expect(mockPaymentRepository.cancelExpiredPayment).not.toHaveBeenCalled();
    });

    // Should cancel all expired payments successfully
    it('debe cancelar todos los pagos expirados exitosamente', async () => {
        const expiredPayments = [
            new Payment('payment-1', 100, 'USD', 'PENDING', 'order-1', new Date()),
            new Payment('payment-2', 200, 'USD', 'PENDING', 'order-2', new Date()),
            new Payment('payment-3', 300, 'USD', 'PENDING', 'order-3', new Date()),
        ];

        (mockPaymentRepository.findExpiredPayments as jest.Mock).mockResolvedValue(expiredPayments);
        (mockPaymentRepository.cancelExpiredPayment as jest.Mock).mockResolvedValue(undefined);

        await useCase.execute();

        expect(mockPaymentRepository.findExpiredPayments).toHaveBeenCalledTimes(1);
        expect(mockPaymentRepository.cancelExpiredPayment).toHaveBeenCalledTimes(3);
        expect(mockPaymentRepository.cancelExpiredPayment).toHaveBeenCalledWith('order-1');
        expect(mockPaymentRepository.cancelExpiredPayment).toHaveBeenCalledWith('order-2');
        expect(mockPaymentRepository.cancelExpiredPayment).toHaveBeenCalledWith('order-3');
    });

    // Should continue canceling other payments even if one fails
    it('debe continuar cancelando otros pagos aunque uno falle', async () => {
        const expiredPayments = [
            new Payment('payment-1', 100, 'USD', 'PENDING', 'order-1', new Date()),
            new Payment('payment-2', 200, 'USD', 'PENDING', 'order-2', new Date()),
            new Payment('payment-3', 300, 'USD', 'PENDING', 'order-3', new Date()),
        ];

        (mockPaymentRepository.findExpiredPayments as jest.Mock).mockResolvedValue(expiredPayments);

        (mockPaymentRepository.cancelExpiredPayment as jest.Mock)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('Database error'))
            .mockResolvedValueOnce(undefined);

        await useCase.execute();

        expect(mockPaymentRepository.cancelExpiredPayment).toHaveBeenCalledTimes(3);
        expect(mockPaymentRepository.cancelExpiredPayment).toHaveBeenCalledWith('order-1');
        expect(mockPaymentRepository.cancelExpiredPayment).toHaveBeenCalledWith('order-2');
        expect(mockPaymentRepository.cancelExpiredPayment).toHaveBeenCalledWith('order-3');
    });

    // Should search for payments with expiration time of 10 minutes ago
    it('debe buscar pagos con fecha de expiración de 10 minutos atrás', async () => {
        (mockPaymentRepository.findExpiredPayments as jest.Mock).mockResolvedValue([]);

        const beforeExecute = new Date();

        await useCase.execute();

        expect(mockPaymentRepository.findExpiredPayments).toHaveBeenCalled();

        const callArgs = (mockPaymentRepository.findExpiredPayments as jest.Mock).mock.calls[0][0];
        const expirationDate = callArgs as Date;

        const tenMinutesAgo = new Date(beforeExecute.getTime() - 10 * 60 * 1000);

        const timeDifference = Math.abs(expirationDate.getTime() - tenMinutesAgo.getTime());
        expect(timeDifference).toBeLessThan(1000);
    });
});
