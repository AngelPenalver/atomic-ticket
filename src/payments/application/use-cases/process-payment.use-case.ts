import { ConflictException, Inject, Logger, NotFoundException } from "@nestjs/common";
import { Payment } from "src/payments/domain/entities/payment.entity";
import type { IPaymentGateway } from "../ports/payment-gateway.interface";
import type { IPaymentRepository } from "src/payments/domain/repositories/payment.repository.interface";
import { Order } from "src/orders/entities/order.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";

export class ProcessPaymentUseCase {
    private readonly logger = new Logger(ProcessPaymentUseCase.name);
    constructor(
        @Inject('IPaymentRepository') private readonly paymentRepository: IPaymentRepository,
        @Inject('IPaymentGateway') private readonly paymentGateway: IPaymentGateway,
        @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    ) { }

    async execute(orderId: string) {
        this.logger.log(`Processing payment for order: ${orderId}`);
        let payment = await this.paymentRepository.findByOrderId(orderId);

        if (!payment) {
            const order = await this.orderRepository.findOneBy({ id: orderId });
            if (!order) throw new NotFoundException('Order not found');

            payment = new Payment(
                crypto.randomUUID(),
                order.amount,
                order.currency,
                'pending',
                orderId,
                new Date()
            );
            await this.paymentRepository.save(payment);
        }

        if (payment.status === 'PAID') {
            throw new ConflictException('This order is already paid');
        }

        try {
            const { externalId, checkoutUrl } = await this.paymentGateway.createPayment(payment);

            payment.setExternalId(externalId);
            await this.paymentRepository.save(payment);

            this.logger.log(`Payment processed successfully for order: ${orderId}`);
            return {
                paymentId: payment.id,
                checkoutUrl: checkoutUrl
            };
        } catch (error) {
            this.logger.error('ProcessPaymentUseCase Error:', error);
            throw error;
        }
    }
}