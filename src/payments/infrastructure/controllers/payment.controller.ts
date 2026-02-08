import { Body, Controller, Post } from "@nestjs/common";
import { ProcessPaymentUseCase } from "src/payments/application/use-cases/process-payment.use-case";
import { CreatePaymentDto } from "../dtos/create-payment.dto";

@Controller('payments')
export class PaymentController {
    constructor(
        private readonly processPaymentUseCase: ProcessPaymentUseCase
    ) { }

    @Post('process')
    async processPayment(@Body() dto: CreatePaymentDto) {
        return await this.processPaymentUseCase.execute(
            dto.orderId,
        );
    }
}