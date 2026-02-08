import { Injectable } from "@nestjs/common"; // <--- Indispensable
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, LessThan, Repository } from "typeorm";
import { IPaymentRepository } from "src/payments/domain/repositories/payment.repository.interface";
import { PAYMENT_STATUS, PaymentEntity } from "./payment.entity";
import { Payment } from "src/payments/domain/entities/payment.entity";
import { PaymentMapper } from "../mappers/payment.mapper";
import { Order, ORDER_STATUS } from "src/orders/entities/order.entity";
import { Seat, STATUS_SEATS } from "src/seats/entities/seat.entity";

@Injectable()
export class TypeOrmPaymentsRepository implements IPaymentRepository {
    constructor(
        @InjectRepository(PaymentEntity)
        private readonly repository: Repository<PaymentEntity>,
        private readonly dataSource: DataSource
    ) { }

    async save(payment: Payment): Promise<Payment> {
        const entity = PaymentMapper.toPersistence(payment);
        const savedEntity = await this.repository.save(entity);
        return PaymentMapper.toDomain(savedEntity);
    }

    async findById(id: string): Promise<Payment | null> {
        const entity = await this.repository.findOne({ where: { id } });
        return entity ? PaymentMapper.toDomain(entity) : null;
    }

    async findByOrderId(orderId: string): Promise<Payment | null> {
        const entity = await this.repository.findOne({ where: { orderId } });
        return entity ? PaymentMapper.toDomain(entity) : null;
    }

    async findExpiredPayments(limitDate: Date): Promise<Payment[]> {
        const entities = await this.repository.find({
            where: {
                createdAt: LessThan(limitDate),
                status: PAYMENT_STATUS.PENDING,
            },
        });

        return entities.map(PaymentMapper.toDomain);
    }

    async cancelExpiredPayment(orderId: string): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const order = await manager.findOne(Order, {
                where: { id: orderId },
                relations: ['seat']
            });

            if (!order) return;
            await manager.update(PaymentEntity,
                { orderId: orderId },
                { status: PAYMENT_STATUS.CANCELLED }
            );

            await manager.update(Order,
                { id: orderId },
                { status: ORDER_STATUS.CANCELLED }
            );

            if (order.seat) {
                await manager.update(Seat,
                    { id: order.seat.id },
                    { status: STATUS_SEATS.AVAILABLE }
                );
            }
        });
    }

    async confirmAndFinalizeSeat(orderId: string, externalId: string): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const order = await manager.findOne(Order, {
                where: { id: orderId },
                relations: ['seat']
            });

            if (!order) return;

            await manager.update(PaymentEntity,
                { orderId: orderId },
                { status: PAYMENT_STATUS.PAID, externalId: externalId }
            );

            await manager.update(Order,
                { id: orderId },
                { status: ORDER_STATUS.PAID }
            );

            if (order.seat) {
                await manager.update(Seat,
                    { id: order.seat.id },
                    { status: STATUS_SEATS.SOLD }
                );
            }
        });
    }

    async cancelAndReleaseSeat(orderId: string): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const order = await manager.findOne(Order, {
                where: { id: orderId },
                relations: ['seat']
            });

            if (!order) return;

            await manager.update(PaymentEntity,
                { orderId: orderId },
                { status: PAYMENT_STATUS.CANCELLED }
            );

            await manager.update(Order,
                { id: orderId },
                { status: ORDER_STATUS.CANCELLED }
            );

            if (order.seat) {
                await manager.update(Seat,
                    { id: order.seat.id },
                    { status: STATUS_SEATS.AVAILABLE }
                );
            }
        });
    }
}