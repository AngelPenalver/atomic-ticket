import { CancelExpiredPaymentsUseCase } from './cancel-expired-payments.use-case';
import type { IPaymentGateway } from '../ports/payment-gateway.interface';
import type { IReservationPort } from '../ports/reservation.port';

describe('CancelExpiredPaymentsUseCase', () => {
  let useCase: CancelExpiredPaymentsUseCase;
  let reservations: jest.Mocked<IReservationPort>;
  let paymentGateway: jest.Mocked<IPaymentGateway>;

  beforeEach(() => {
    reservations = {
      findOrder: jest.fn(),
      findExpiredPendingOrders: jest.fn(),
      markPaid: jest.fn(),
      release: jest.fn().mockResolvedValue('settled'),
    };
    paymentGateway = {
      createCheckout: jest.fn(),
      getCheckout: jest.fn(),
      expireCheckout: jest.fn().mockResolvedValue('expired'),
      refund: jest.fn(),
      parseWebhookEvent: jest.fn(),
    };

    useCase = new CancelExpiredPaymentsUseCase(reservations, paymentGateway);
  });

  it('debe buscar órdenes caducadas en la fecha indicada y por lotes', async () => {
    const now = new Date('2026-09-30T12:00:00Z');
    reservations.findExpiredPendingOrders.mockResolvedValue([]);

    await useCase.execute(now);

    expect(reservations.findExpiredPendingOrders).toHaveBeenCalledWith(
      now,
      100,
    );
    expect(reservations.release).not.toHaveBeenCalled();
  });

  it('debe liberar directamente las órdenes que nunca obtuvieron checkout', async () => {
    reservations.findExpiredPendingOrders.mockResolvedValue([
      { orderId: 'order-1' },
    ]);

    await useCase.execute();

    expect(paymentGateway.expireCheckout).not.toHaveBeenCalled();
    expect(reservations.release).toHaveBeenCalledWith('order-1');
  });

  it('debe cerrar el checkout antes de liberar la orden', async () => {
    reservations.findExpiredPendingOrders.mockResolvedValue([
      { orderId: 'order-1', externalId: 'cs_1' },
    ]);

    await useCase.execute();

    expect(paymentGateway.expireCheckout).toHaveBeenCalledWith('cs_1');
    expect(reservations.release).toHaveBeenCalledWith('order-1');
    expect(
      paymentGateway.expireCheckout.mock.invocationCallOrder[0],
    ).toBeLessThan(reservations.release.mock.invocationCallOrder[0]);
  });

  it('debe confirmar en lugar de liberar si el checkout se pagó en el último momento', async () => {
    reservations.findExpiredPendingOrders.mockResolvedValue([
      { orderId: 'order-1', externalId: 'cs_1' },
    ]);
    paymentGateway.expireCheckout.mockResolvedValue('completed');

    await useCase.execute();

    expect(reservations.markPaid).toHaveBeenCalledWith('order-1', 'cs_1');
    expect(reservations.release).not.toHaveBeenCalled();
  });

  it('debe continuar con las demás órdenes aunque una falle', async () => {
    reservations.findExpiredPendingOrders.mockResolvedValue([
      { orderId: 'order-1', externalId: 'cs_1' },
      { orderId: 'order-2', externalId: 'cs_2' },
      { orderId: 'order-3' },
    ]);
    paymentGateway.expireCheckout
      .mockRejectedValueOnce(new Error('Stripe down'))
      .mockResolvedValueOnce('expired');

    await expect(useCase.execute()).resolves.toBeUndefined();

    expect(reservations.release).not.toHaveBeenCalledWith('order-1');
    expect(reservations.release).toHaveBeenCalledWith('order-2');
    expect(reservations.release).toHaveBeenCalledWith('order-3');
  });
});
