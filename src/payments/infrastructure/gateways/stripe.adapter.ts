import { Logger } from '@nestjs/common';
import Stripe from 'stripe';
import type {
  Checkout,
  CreateCheckoutInput,
  IPaymentGateway,
  PaymentWebhookEvent,
} from '../../application/ports/payment-gateway.interface';
import {
  InvalidWebhookError,
  PaymentGatewayError,
} from 'src/payments/domain/errors/payment.errors';

/** Duración mínima y máxima que Stripe permite para una sesión de checkout. */
const MIN_CHECKOUT_LIFETIME_MS = 31 * 60 * 1000;
const MAX_CHECKOUT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface StripeAdapterOptions {
  secretKey: string;
  webhookSecret: string;
  frontendUrl: string;
}

/** Implementación de IPaymentGateway con Stripe Checkout. */
export class StripeAdapter implements IPaymentGateway {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeAdapter.name);

  constructor(private readonly options: StripeAdapterOptions) {
    this.stripe = new Stripe(options.secretKey, {
      apiVersion: '2026-01-28.clover',
    });
  }

  createCheckout(
    input: CreateCheckoutInput,
  ): Promise<{ externalId: string; checkoutUrl: string }> {
    return this.call('createCheckout', () => this.createCheckoutSession(input));
  }

  getCheckout(externalId: string): Promise<Checkout> {
    return this.call('getCheckout', () => this.retrieveCheckout(externalId));
  }

  expireCheckout(externalId: string): Promise<'expired' | 'completed'> {
    return this.call('expireCheckout', () =>
      this.expireCheckoutSession(externalId),
    );
  }

  refund(externalId: string): Promise<void> {
    return this.call('refund', () => this.refundCheckout(externalId));
  }

  private async createCheckoutSession(
    input: CreateCheckoutInput,
  ): Promise<{ externalId: string; checkoutUrl: string }> {
    const session = await this.stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: { name: 'Atomic Ticket' },
            unit_amount: toMinorUnits(input.amount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: { orderId: input.orderId },
      client_reference_id: input.orderId,
      expires_at: toCheckoutExpiration(input.expiresAt),
      success_url: `${this.options.frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.options.frontendUrl}/cancel`,
    });

    if (!session.url) {
      throw new Error(`Stripe session ${session.id} has no checkout URL`);
    }

    this.logger.log(
      `Stripe session ${session.id} created for order ${input.orderId}`,
    );
    return { externalId: session.id, checkoutUrl: session.url };
  }

  private async retrieveCheckout(externalId: string): Promise<Checkout> {
    const session = await this.stripe.checkout.sessions.retrieve(externalId);
    return {
      externalId: session.id,
      status: session.status ?? 'open',
      checkoutUrl: session.url,
    };
  }

  private async expireCheckoutSession(
    externalId: string,
  ): Promise<'expired' | 'completed'> {
    try {
      await this.stripe.checkout.sessions.expire(externalId);
      return 'expired';
    } catch (error) {
      const { status } = await this.retrieveCheckout(externalId);
      if (status === 'complete') return 'completed';
      if (status === 'expired') return 'expired';
      throw error;
    }
  }

  private async refundCheckout(externalId: string): Promise<void> {
    const session = await this.stripe.checkout.sessions.retrieve(externalId);
    const paymentIntent =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    if (!paymentIntent) {
      throw new Error(
        `Stripe session ${externalId} has no payment intent to refund`,
      );
    }

    await this.stripe.refunds.create(
      { payment_intent: paymentIntent },
      { idempotencyKey: `refund-${externalId}` },
    );
    this.logger.warn(`Refund issued for Stripe session ${externalId}`);
  }

  /** Ejecuta una llamada a Stripe y envuelve sus errores en PaymentGatewayError. */
  private async call<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(
        `Stripe ${operation} failed`,
        error instanceof Error ? error.stack : error,
      );
      throw new PaymentGatewayError(operation, error);
    }
  }

  parseWebhookEvent(rawBody: Buffer, signature: string): PaymentWebhookEvent {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.options.webhookSecret,
      );
    } catch (error) {
      throw new InvalidWebhookError(
        error instanceof Error
          ? error.message
          : 'signature verification failed',
      );
    }

    switch (event.type) {
      case 'checkout.session.completed':
        if (event.data.object.payment_status === 'unpaid') {
          return { type: 'ignored', name: `${event.type} (unpaid)` };
        }
        return toWebhookEvent('checkout.paid', event.data.object);
      case 'checkout.session.async_payment_succeeded':
        return toWebhookEvent('checkout.paid', event.data.object);
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed':
        return toWebhookEvent('checkout.expired', event.data.object);
      default:
        return { type: 'ignored', name: event.type };
    }
  }
}

/** Construye un PaymentWebhookEvent a partir de una sesión de Stripe. */
function toWebhookEvent(
  type: 'checkout.paid' | 'checkout.expired',
  session: Stripe.Checkout.Session,
): PaymentWebhookEvent {
  return { type, externalId: session.id, orderId: session.metadata?.orderId };
}

/** Convierte un importe decimal (19.99) a céntimos (1999). */
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** Ajusta la caducidad al rango que permite Stripe y la devuelve en segundos. */
function toCheckoutExpiration(expiresAt: Date): number {
  const now = Date.now();
  const clamped = Math.min(
    Math.max(expiresAt.getTime(), now + MIN_CHECKOUT_LIFETIME_MS),
    now + MAX_CHECKOUT_LIFETIME_MS,
  );
  return Math.floor(clamped / 1000);
}
