import { ConfirmPaymentUseCase } from './confirm-payment.use-case';
import type { IPaymentGateway } from '../ports/payment-gateway.interface';
import type { IReservationPort } from '../ports/reservation.port';

describe('ConfirmPaymentUseCase', () => {
  let useCase: ConfirmPaymentUseCase;
  let reservations: jest.Mocked<IReservationPort>;
  let paymentGateway: jest.Mocked<IPaymentGateway>;

  beforeEach(() => {
    reservations = {
      findOrder: jest.fn(),
      findExpiredPendingOrders: jest.fn(),
      markPaid: jest.fn(),
      release: jest.fn(),
    };
    paymentGateway = {
      createCheckout: jest.fn(),
      getCheckout: jest.fn(),
      expireCheckout: jest.fn(),
      refund: jest.fn(),
      parseWebhookEvent: jest.fn(),
    };

    useCase = new ConfirmPaymentUseCase(reservations, paymentGateway);
  });

  it('debe marcar la orden como pagada', async () => {
    reservations.markPaid.mockResolvedValue('settled');

    const result = await useCase.execute('order-123', 'cs_test_123');

    expect(result).toBe('settled');
    expect(reservations.markPaid).toHaveBeenCalledWith(
      'order-123',
      'cs_test_123',
    );
    expect(paymentGateway.refund).not.toHaveBeenCalled();
  });

  it.each(['already_settled', 'not_found'] as const)(
    'no debe reembolsar cuando el resultado es %s',
    async (settlement) => {
      reservations.markPaid.mockResolvedValue(settlement);

      await expect(useCase.execute('order-123', 'cs_test_123')).resolves.toBe(
        settlement,
      );
      expect(paymentGateway.refund).not.toHaveBeenCalled();
    },
  );

  it('debe reembolsar un pago que llega después de cancelar la orden', async () => {
    reservations.markPaid.mockResolvedValue('conflict');

    const result = await useCase.execute('order-123', 'cs_late');

    expect(result).toBe('conflict');
    expect(paymentGateway.refund).toHaveBeenCalledWith('cs_late');
  });

  it('debe relanzar el error si el reembolso falla, para que Stripe reintente', async () => {
    reservations.markPaid.mockResolvedValue('conflict');
    paymentGateway.refund.mockRejectedValue(new Error('Refund failed'));

    await expect(useCase.execute('order-123', 'cs_late')).rejects.toThrow(
      'Refund failed',
    );
  });
});
