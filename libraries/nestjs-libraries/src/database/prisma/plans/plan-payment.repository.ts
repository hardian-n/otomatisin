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
    uniqueCode?: number | null;
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

  getPaymentById(id: string) {
    return this._payment.model.planPayment.findUnique({
      where: { id },
      include: {
        plan: true,
        organization: true,
        user: true,
        subscription: true,
      },
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
      include: {
        plan: true,
        organization: true,
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  getLatestPendingPayment(organizationId: string) {
    return this._payment.model.planPayment.findFirst({
      where: {
        organizationId,
        status: 'PENDING',
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async hasPendingManualPaymentAmount(organizationId: string, amount: number) {
    const payment = await this._payment.model.planPayment.findFirst({
      where: {
        organizationId,
        status: 'PENDING',
        provider: PaymentProvider.MANUAL,
        amount,
      },
      select: { id: true },
    });
    return Boolean(payment);
  }

  deletePayment(id: string) {
    return this._payment.model.planPayment.delete({
      where: { id },
    });
  }

  async hasPaidPaymentForPlanKey(organizationId: string, planKey: string) {
    const normalizedKey = planKey.trim().toUpperCase();
    const payment = await this._payment.model.planPayment.findFirst({
      where: {
        organizationId,
        status: 'PAID',
        plan: {
          key: normalizedKey,
        },
      },
      select: { id: true },
    });
    return Boolean(payment);
  }
}
