import { Controller, Post, Headers, Req, Res, BadRequestException, Logger } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request, Response } from "express";
import Stripe from "stripe";
import { ConfirmPaymentUseCase } from "src/payments/application/use-cases/confirm-payment.use-case";
import { CancelPaymentUseCase } from "src/payments/application/use-cases/cancel-payment.use-case";

@Controller('webhooks')
export class StripeWebhookController {
    private readonly stripe: Stripe;
    private readonly endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    private readonly logger = new Logger(StripeWebhookController.name);

    constructor(private readonly confirmPaymentUseCase: ConfirmPaymentUseCase, private readonly cancelPaymentUseCase: CancelPaymentUseCase) {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2026-01-28.clover',
        });
    }

    @Post('stripe')
    async handleStripe(
        @Headers('stripe-signature') sig: string,
        @Req() req: RawBodyRequest<Request>,
        @Res() res: Response
    ) {
        if (!sig || !req.rawBody) {
            throw new BadRequestException('Missing signature or request body');
        }

        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(
                req.rawBody,
                sig,
                this.endpointSecret
            );
        } catch (err) {
            this.logger.error(`Error validating webhook: ${err.message}`);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object as Stripe.Checkout.Session;

                const orderId = session.metadata?.orderId;

                if (!orderId || !session.amount_total || !session.currency) {
                    this.logger.error('Invalid session data');
                    throw new BadRequestException('Invalid session data');
                }

                this.logger.log(`Payment completed for order: ${orderId}`);

                await this.confirmPaymentUseCase.execute(orderId, session.id);

                this.logger.log(`Order ${orderId} confirmed and seat finalized.`);

                break;

            case 'checkout.session.expired':
                const expiredSession = event.data.object as Stripe.Checkout.Session;
                const expiredOrderId = expiredSession.metadata?.orderId;

                if (!expiredOrderId) {
                    this.logger.error('Invalid session data');
                    throw new BadRequestException('Invalid session data');
                }

                await this.cancelPaymentUseCase.execute(expiredOrderId);

                this.logger.warn(`Order ${expiredOrderId} cancelled due to expiration.`);
                break;

            default:
                this.logger.log(`Event not handled: ${event.type}`);
        }

        return res.status(200).send({ received: true });
    }
}