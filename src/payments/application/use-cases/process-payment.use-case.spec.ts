import { ProcessPaymentUseCase } from './process-payment.use-case';
import type { IPaymentRepository } from 'src/payments/domain/repositories/payment.repository.interface';
import type { IPaymentGateway } from '../ports/payment-gateway.interface';
import type {
  IReservationPort,
  ReservationSnapshot,
} from '../ports/reservation.port';
import {
  Payment,
  PaymentStatus,
} from 'src/payments/domain/entities/payment.entity';
import {
  CheckoutUnavailableError,
  OrderAlreadyPaidError,
  OrderNotFoundError,
  OrderNotPayableError,
} from 'src/payments/domain/errors/payment.errors';

const ORDER_ID = 'order-123';
const CHECKOUT_URL = 'https://checkout.stripe.com/pay/cs_test_123';

function buildOrder(
  overrides: Partial<ReservationSnapshot> = {},
): ReservationSnapshot {
  return {
    orderId: ORDER_ID,
    status: 'pending',
    amount: 19.99,
    currency: 'USD',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ...overrides,
  };
}

function buildPayment(externalId?: string): Payment {
  return new Payment(
    'payment-1',
    19.99,
    'USD',
    PaymentStatus.PENDING,
    ORDER_ID,
    new Date(),
    externalId,
  );
}

describe('ProcessPaymentUseCase', () => {
  let useCase: ProcessPaymentUseCase;
  let paymentRepository: jest.Mocked<IPaymentRepository>;
  let reservations: jest.Mocked<IReservationPort>;
  let paymentGateway: jest.Mocked<IPaymentGateway>;

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
    paymentGateway = {
      createCheckout: jest.fn(),
      getCheckout: jest.fn(),
      expireCheckout: jest.fn(),
      refund: jest.fn(),
      parseWebhookEvent: jest.fn(),
    };

    useCase = new ProcessPaymentUseCase(
      paymentRepository,
      reservations,
      paymentGateway,
    );
  });

  it('debe crear un pago y un checkout nuevos y devolver su URL', async () => {
    const order = buildOrder();
    reservations.findOrder.mockResolvedValue(order);
    paymentRepository.createIfAbsent.mockResolvedValue(buildPayment());
    paymentGateway.createCheckout.mockResolvedValue({
      externalId: 'cs_test_123',
      checkoutUrl: CHECKOUT_URL,
    });
    paymentRepository.attachExternalId.mockResolvedValue(true);

    const result = await useCase.execute(ORDER_ID);

    expect(result).toEqual({
      paymentId: 'payment-1',
      checkoutUrl: CHECKOUT_URL,
    });
    expect(paymentRepository.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        amount: 19.99,
        currency: 'USD',
        status: PaymentStatus.PENDING,
      }),
    );
    expect(paymentGateway.createCheckout).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      amount: 19.99,
      currency: 'USD',
      expiresAt: order.expiresAt,
    });
    expect(paymentRepository.attachExternalId).toHaveBeenCalledWith(
      'payment-1',
      'cs_test_123',
    );
  });

  it('debe lanzar OrderNotFoundError si la orden no existe', async () => {
    reservations.findOrder.mockResolvedValue(null);

    await expect(useCase.execute(ORDER_ID)).rejects.toThrow(OrderNotFoundError);
    expect(paymentRepository.createIfAbsent).not.toHaveBeenCalled();
  });

  it('debe lanzar OrderAlreadyPaidError si la orden ya está pagada', async () => {
    reservations.findOrder.mockResolvedValue(buildOrder({ status: 'paid' }));

    await expect(useCase.execute(ORDER_ID)).rejects.toThrow(
      OrderAlreadyPaidError,
    );
    expect(paymentGateway.createCheckout).not.toHaveBeenCalled();
  });

  it.each([
    ['cancelada', buildOrder({ status: 'cancelled' })],
    ['caducada', buildOrder({ expiresAt: new Date(Date.now() - 1000) })],
  ])(
    'debe lanzar OrderNotPayableError si la orden está %s',
    async (_, order) => {
      reservations.findOrder.mockResolvedValue(order);

      await expect(useCase.execute(ORDER_ID)).rejects.toThrow(
        OrderNotPayableError,
      );
      expect(paymentGateway.createCheckout).not.toHaveBeenCalled();
    },
  );

  describe('reintento con un checkout existente', () => {
    beforeEach(() => {
      reservations.findOrder.mockResolvedValue(buildOrder());
      paymentRepository.createIfAbsent.mockResolvedValue(
        buildPayment('cs_existing'),
      );
    });

    it('debe devolver la URL del checkout abierto sin crear otro', async () => {
      paymentGateway.getCheckout.mockResolvedValue({
        externalId: 'cs_existing',
        status: 'open',
        checkoutUrl: CHECKOUT_URL,
      });

      const result = await useCase.execute(ORDER_ID);

      expect(result.checkoutUrl).toBe(CHECKOUT_URL);
      expect(paymentGateway.getCheckout).toHaveBeenCalledWith('cs_existing');
      expect(paymentGateway.createCheckout).not.toHaveBeenCalled();
    });

    it('debe lanzar OrderAlreadyPaidError si el checkout ya se completó', async () => {
      paymentGateway.getCheckout.mockResolvedValue({
        externalId: 'cs_existing',
        status: 'complete',
        checkoutUrl: null,
      });

      await expect(useCase.execute(ORDER_ID)).rejects.toThrow(
        OrderAlreadyPaidError,
      );
    });

    it('debe lanzar CheckoutUnavailableError si el checkout expiró', async () => {
      paymentGateway.getCheckout.mockResolvedValue({
        externalId: 'cs_existing',
        status: 'expired',
        checkoutUrl: null,
      });

      await expect(useCase.execute(ORDER_ID)).rejects.toThrow(
        CheckoutUnavailableError,
      );
      expect(paymentGateway.createCheckout).not.toHaveBeenCalled();
    });
  });

  it('debe descartar su checkout y reutilizar el de una petición concurrente', async () => {
    reservations.findOrder.mockResolvedValue(buildOrder());
    paymentRepository.createIfAbsent.mockResolvedValue(buildPayment());
    paymentGateway.createCheckout.mockResolvedValue({
      externalId: 'cs_loser',
      checkoutUrl: 'https://checkout.stripe.com/pay/cs_loser',
    });
    paymentRepository.attachExternalId.mockResolvedValue(false);
    paymentRepository.findByOrderId.mockResolvedValue(
      buildPayment('cs_winner'),
    );
    paymentGateway.getCheckout.mockResolvedValue({
      externalId: 'cs_winner',
      status: 'open',
      checkoutUrl: CHECKOUT_URL,
    });

    const result = await useCase.execute(ORDER_ID);

    expect(paymentGateway.expireCheckout).toHaveBeenCalledWith('cs_loser');
    expect(paymentGateway.getCheckout).toHaveBeenCalledWith('cs_winner');
    expect(result.checkoutUrl).toBe(CHECKOUT_URL);
  });

  it('debe relanzar el error si el gateway falla', async () => {
    reservations.findOrder.mockResolvedValue(buildOrder());
    paymentRepository.createIfAbsent.mockResolvedValue(buildPayment());
    paymentGateway.createCheckout.mockRejectedValue(new Error('Stripe down'));

    await expect(useCase.execute(ORDER_ID)).rejects.toThrow('Stripe down');
    expect(paymentRepository.attachExternalId).not.toHaveBeenCalled();
  });
});
