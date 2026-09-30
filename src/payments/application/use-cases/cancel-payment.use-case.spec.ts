import { CancelPaymentUseCase } from './cancel-payment.use-case';
import type { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';
import type { IReservationPort } from '../ports/reservation.port';
import {
  Payment,
  PaymentStatus,
} from 'src/payments/domain/entities/payment.entity';

function buildPayment(externalId?: string): Payment {
  return new Payment(
    'payment-1',
    100,
    'USD',
    PaymentStatus.PENDING,
    'order-123',
    new Date(),
    externalId,
  );
}

describe('CancelPaymentUseCase', () => {
  let useCase: CancelPaymentUseCase;
  let paymentRepository: jest.Mocked<IPaymentRepository>;
  let reservations: jest.Mocked<IReservationPort>;

  beforeEach(() => {
    paymentRepository = {
      findByOrderId: jest.fn(),
      createIfAbsent: jest.fn(),
      attachExternalId: jest.fn(),
    };
    reservations = {
      findOrder: jest.fn(),
      findExpiredPendingOrders: jest.fn(),
      markPaid: jest.fn(),
      release: jest.fn(),
    };

    useCase = new CancelPaymentUseCase(paymentRepository, reservations);
  });

  it('debe liberar la reserva cuando expira el checkout actual', async () => {
    paymentRepository.findByOrderId.mockResolvedValue(
      buildPayment('cs_current'),
    );
    reservations.release.mockResolvedValue('settled');

    const result = await useCase.execute('order-123', 'cs_current');

    expect(result).toBe('settled');
    expect(reservations.release).toHaveBeenCalledWith('order-123');
  });

  it('debe ignorar la expiración de un checkout que no es el actual', async () => {
    paymentRepository.findByOrderId.mockResolvedValue(
      buildPayment('cs_current'),
    );

    const result = await useCase.execute('order-123', 'cs_discarded');

    expect(result).toBe('stale');
    expect(reservations.release).not.toHaveBeenCalled();
  });

  it('debe ignorar la expiración si la orden no tiene pago', async () => {
    paymentRepository.findByOrderId.mockResolvedValue(null);

    await expect(useCase.execute('order-123', 'cs_any')).resolves.toBe('stale');
    expect(reservations.release).not.toHaveBeenCalled();
  });

  it('debe relanzar el error si falla la liberación', async () => {
    paymentRepository.findByOrderId.mockResolvedValue(
      buildPayment('cs_current'),
    );
    reservations.release.mockRejectedValue(new Error('Database error'));

    await expect(useCase.execute('order-123', 'cs_current')).rejects.toThrow(
      'Database error',
    );
  });
});
