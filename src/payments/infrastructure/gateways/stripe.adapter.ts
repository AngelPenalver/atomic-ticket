import { BadRequestException, Logger } from "@nestjs/common";
import { IPaymentGateway } from "../../application/ports/payment-gateway.interface";
import { Payment } from "../../domain/entities/payment.entity";
import Stripe from "stripe";


export class StripeAdapter implements IPaymentGateway {
    private stripe: Stripe;
    private readonly logger = new Logger(StripeAdapter.name);
    constructor(private apiKey: string) {
        this.stripe = new Stripe(apiKey, {
            apiVersion: '2026-01-28.clover',
        });
    }

    async createPayment(payment: Payment): Promise<{ externalId: string; checkoutUrl: string }> {
        try {
            this.logger.log('Creating Stripe checkout session with:', {
                amount: payment.amount,
                currency: payment.currency,
                success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/cancel`,
            });

            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: payment.currency,
                            product_data: {
                                name: 'Atomic Ticket',
                            },
                            unit_amount: payment.amount * 100,
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                metadata: {
                    orderId: payment.orderId,
                },
                success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/cancel`,
            });

            if (!session.url) {
                throw new BadRequestException('Stripe session URL not found');
            }

            this.logger.log('Stripe session created successfully:', session.id);
            return { externalId: session.id, checkoutUrl: session.url };
        } catch (error) {
            this.logger.error('Stripe payment creation failed:', error);
            throw error;
        }
    }
    async getPaymentStatus(externalId: string): Promise<string> {
        const session = await this.stripe.checkout.sessions.retrieve(externalId);
        return session.payment_status as string;
    }
}