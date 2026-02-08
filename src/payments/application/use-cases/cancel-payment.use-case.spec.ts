import { Test, TestingModule } from '@nestjs/testing';
import { CancelPaymentUseCase } from './cancel-payment.use-case';
import type { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';

describe('CancelPaymentUseCase', () => {
    let useCase: CancelPaymentUseCase;
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
                CancelPaymentUseCase,
                {
                    provide: 'IPaymentRepository',
                    useValue: mockPaymentRepository,
                },
            ],
        }).compile();

        useCase = module.get<CancelPaymentUseCase>(CancelPaymentUseCase);
        paymentRepository = module.get<IPaymentRepository>('IPaymentRepository');

        jest.clearAllMocks();
    });

    // Should call repository to cancel payment and release seat
    it('debe llamar al repositorio para cancelar el pago y liberar el asiento', async () => {
        const orderId = 'order-123';

        (mockPaymentRepository.cancelAndReleaseSeat as jest.Mock).mockResolvedValue(undefined);

        await useCase.execute(orderId);

        expect(mockPaymentRepository.cancelAndReleaseSeat).toHaveBeenCalled();
        expect(mockPaymentRepository.cancelAndReleaseSeat).toHaveBeenCalledTimes(1);
        expect(mockPaymentRepository.cancelAndReleaseSeat).toHaveBeenCalledWith(orderId);
    });

    // Should rethrow error if repository fails
    it('debe relanzar el error si el repositorio falla', async () => {
        const orderId = 'order-456';

        const repositoryError = new Error('Order not found in database');
        (mockPaymentRepository.cancelAndReleaseSeat as jest.Mock).mockRejectedValue(repositoryError);

        await expect(useCase.execute(orderId)).rejects.toThrow('Order not found in database');

        expect(mockPaymentRepository.cancelAndReleaseSeat).toHaveBeenCalledWith(orderId);
    });
});
