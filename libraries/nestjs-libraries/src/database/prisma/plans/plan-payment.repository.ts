import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PaymentStatus, PaymentProvider } from '@prisma/client';

@Injectable()
export class PlanPaymentRepository {
  constructor(private readonly _payment: PrismaRepository<'planPayment'>) {}

  createPayment(data: {
    organizationId: string;
    planId: string;
    userId?: string | null;
    subscriptionId?: string | null;
    status: PaymentStatus;
    amount: number;
    currency: string;
    provider: PaymentProvider;
    merchantOrderId: string;
    reference?: string | null;
    paymentMethod?: string | null;
    checkoutUrl?: string | null;
    expiresAt?: Date | null;
    requestPayload?: any;
    responsePayload?: any;
  }) {
    return this._payment.model.planPayment.create({
      data: {
        ...data,
        requestPayload: data.requestPayload ? data.requestPayload : undefined,
        responsePayload: data.responsePayload ? data.responsePayload : undefined,
      },
    });
  }

  updatePayment(
    id: string,
    data: Partial<{
      status: PaymentStatus;
      reference: string | null;
      paymentMethod: string | null;
      checkoutUrl: string | null;
      expiresAt: Date | null;
      paidAt: Date | null;
      responsePayload: any;
      callbackPayload: any;
      subscriptionId: string | null;
    }>
  ) {
    return this._payment.model.planPayment.update({
      where: { id },
      data: {
        ...data,
        responsePayload: data.responsePayload
          ? data.responsePayload
          : undefined,
        callbackPayload: data.callbackPayload
          ? data.callbackPayload
          : undefined,
      },
    });
  }

  getPaymentByMerchantOrderId(merchantOrderId: string) {
    return this._payment.model.planPayment.findUnique({
      where: { merchantOrderId },
    });
  }

  listPayments(params: {
    status?: PaymentStatus;
    orgId?: string;
    skip?: number;
    take?: number;
  }) {
    return this._payment.model.planPayment.findMany({
      where: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.orgId ? { organizationId: params.orgId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }
}
