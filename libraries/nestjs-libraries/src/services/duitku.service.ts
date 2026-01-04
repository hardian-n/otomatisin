import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import dayjs from 'dayjs';
import { PaymentProvider, PaymentStatus, DuitkuMode } from '@prisma/client';
import { PlanPaymentRepository } from '@gitroom/nestjs-libraries/database/prisma/plans/plan-payment.repository';
import { PaymentSettingsRepository } from '@gitroom/nestjs-libraries/database/prisma/payments/payment-settings.repository';
import { PlansService } from '@gitroom/nestjs-libraries/database/prisma/plans/plans.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

type DuitkuSettings = {
  merchantCode: string;
  apiKey: string;
  mode: DuitkuMode;
};

type CreatePaymentInput = {
  organizationId: string;
  userId: string;
  planId?: string | null;
  planKey?: string | null;
  paymentMethod?: string | null;
  returnUrl?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
};

@Injectable()
export class DuitkuService {
  constructor(
    private readonly _planPaymentRepository: PlanPaymentRepository,
    private readonly _paymentSettingsRepository: PaymentSettingsRepository,
    private readonly _plansService: PlansService,
    private readonly _subscriptionService: SubscriptionService
  ) {}

  private getApiBaseUrl(mode: DuitkuMode) {
    return mode === DuitkuMode.PRODUCTION
      ? 'https://passport.duitku.com'
      : 'https://sandbox.duitku.com';
  }

  private getPrimaryUrl(value?: string | null) {
    if (!value) {
      return '';
    }
    return value.split(',')[0].trim().replace(/\/+$/, '');
  }

  private async getSettings(): Promise<DuitkuSettings> {
    const settings =
      await this._paymentSettingsRepository.getProviderSettings(
        PaymentProvider.DUITKU
      );

    if (!settings?.merchantCode || !settings?.apiKey) {
      throw new BadRequestException('Duitku settings are not configured');
    }

    return {
      merchantCode: settings.merchantCode,
      apiKey: settings.apiKey,
      mode: settings.mode,
    };
  }

  private sign(value: string) {
    return createHash('md5').update(value).digest('hex');
  }

  private getCallbackUrl() {
    const base = this.getPrimaryUrl(process.env.NEXT_PUBLIC_BACKEND_URL);
    if (!base) {
      throw new BadRequestException('NEXT_PUBLIC_BACKEND_URL is not configured');
    }
    return `${base}/public/duitku/callback`;
  }

  private getReturnUrl(override?: string | null) {
    const base =
      this.getPrimaryUrl(override) ||
      this.getPrimaryUrl(process.env.FRONTEND_URL);
    if (!base) {
      throw new BadRequestException('FRONTEND_URL is not configured');
    }
    return `${base}/billing/invoice`;
  }

  async getPaymentMethods(amount: number) {
    if (!amount || amount <= 0) {
      return [];
    }

    const settings = await this.getSettings();
    const baseUrl = this.getApiBaseUrl(settings.mode);
    const dateTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const signature = this.sign(
      `${settings.merchantCode}${amount}${dateTime}${settings.apiKey}`
    );

    const response = await fetch(
      `${baseUrl}/webapi/api/merchant/paymentmethod/getpaymentmethod`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantCode: settings.merchantCode,
          amount,
          datetime: dateTime,
          signature,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new BadRequestException(
        data?.Message || data?.message || 'Failed to fetch payment methods'
      );
    }

    return data?.paymentFee || [];
  }

  async createPayment(input: CreatePaymentInput) {
    const plan =
      input.planId
        ? await this._plansService.getPlanById(input.planId)
        : input.planKey
          ? await this._plansService.getPlanByKey(input.planKey)
          : await this._plansService.getDefaultPlan();

    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    if (
      plan.key?.toUpperCase() === 'FREE' &&
      (await this._planPaymentRepository.hasPaidPaymentForPlanKey(
        input.organizationId,
        'FREE'
      ))
    ) {
      throw new BadRequestException('Free plan already used');
    }

    if (plan.price <= 0) {
      await this._subscriptionService.adminUpdateSubscription(
        input.organizationId,
        {
          planId: plan.id,
          status: 'ACTIVE',
        }
      );

      return {
        status: 'PAID',
        provider: PaymentProvider.DUITKU,
        checkoutUrl: null,
        plan,
      };
    }

    const settings = await this.getSettings();
    const baseUrl = this.getApiBaseUrl(settings.mode);
    const amount = Number(plan.price);
    const paymentMethod =
      input.paymentMethod ||
      (await this.getPaymentMethods(amount))[0]?.paymentMethod;

    if (!paymentMethod) {
      throw new BadRequestException('Payment method is required');
    }

    const merchantOrderId = `ORD-${makeId(12)}`;
    const signature = this.sign(
      `${settings.merchantCode}${merchantOrderId}${amount}${settings.apiKey}`
    );
    const expiryMinutes = 60;
    const callbackUrl = this.getCallbackUrl();
    const returnUrl = this.getReturnUrl(input.returnUrl);
    const previousSubscription =
      await this._subscriptionService.getSubscriptionSnapshot(
        input.organizationId
      );

    const payload = {
      merchantCode: settings.merchantCode,
      paymentAmount: amount,
      paymentMethod,
      merchantOrderId,
      productDetails: `${plan.name} plan`,
      customerVaName: input.customerName || 'Customer',
      email: input.customerEmail || undefined,
      phoneNumber: input.customerPhone || undefined,
      callbackUrl,
      returnUrl,
      expiryPeriod: expiryMinutes,
      signature,
    };

    const response = await fetch(
      `${baseUrl}/webapi/api/merchant/v2/inquiry`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.statusCode !== '00') {
      throw new BadRequestException(
        data?.statusMessage || 'Failed to create Duitku invoice'
      );
    }

    const expiresAt = dayjs().add(expiryMinutes, 'minute').toDate();

    const payment = await this._planPaymentRepository.createPayment({
      organizationId: input.organizationId,
      planId: plan.id,
      userId: input.userId,
      status: PaymentStatus.PENDING,
      amount,
      currency: plan.currency || 'IDR',
      provider: PaymentProvider.DUITKU,
      merchantOrderId,
      reference: data?.reference || null,
      paymentMethod,
      checkoutUrl: data?.paymentUrl || null,
      expiresAt,
      requestPayload: previousSubscription
        ? { ...payload, previousSubscription }
        : payload,
      responsePayload: data,
    });

    await this._subscriptionService.adminUpdateSubscription(
      input.organizationId,
      {
        planId: plan.id,
        status: 'PENDING',
      }
    );

    return {
      status: payment.status,
      provider: payment.provider,
      checkoutUrl: payment.checkoutUrl,
      plan,
      paymentId: payment.id,
    };
  }

  async handleCallback(payload: {
    merchantCode?: string;
    amount?: string | number;
    merchantOrderId?: string;
    resultCode?: string;
    reference?: string;
    paymentMethod?: string;
    signature?: string;
  }) {
    const merchantCode = payload.merchantCode || '';
    const merchantOrderId = payload.merchantOrderId || '';
    const amount = payload.amount ?? 0;

    if (!merchantCode || !merchantOrderId) {
      throw new BadRequestException('Missing callback payload');
    }

    const settings = await this.getSettings();
    const expectedSignature = this.sign(
      `${merchantCode}${amount}${merchantOrderId}${settings.apiKey}`
    );

    if (payload.signature !== expectedSignature) {
      throw new BadRequestException('Invalid callback signature');
    }

    const payment =
      await this._planPaymentRepository.getPaymentByMerchantOrderId(
        merchantOrderId
      );
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (payment.status === PaymentStatus.PAID) {
      return { ok: true };
    }

    const resultCode = payload.resultCode || '';
    const nextStatus =
      resultCode === '00' ? PaymentStatus.PAID : PaymentStatus.FAILED;

    await this._planPaymentRepository.updatePayment(payment.id, {
      status: nextStatus,
      reference: payload.reference || payment.reference || null,
      paymentMethod: payload.paymentMethod || payment.paymentMethod || null,
      paidAt: nextStatus === PaymentStatus.PAID ? new Date() : null,
      callbackPayload: payload,
    });

    if (nextStatus === PaymentStatus.PAID) {
      await this._subscriptionService.adminUpdateSubscription(
        payment.organizationId,
        {
          planId: payment.planId,
          status: 'ACTIVE',
        }
      );
    }

    return { ok: true };
  }

  async markPaymentStatus(paymentId: string, status: PaymentStatus) {
    const payment = await this._planPaymentRepository.getPaymentById(paymentId);
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    await this._planPaymentRepository.updatePayment(payment.id, {
      status,
      paidAt: status === PaymentStatus.PAID ? new Date() : null,
    });

    if (status === PaymentStatus.PAID) {
      await this._subscriptionService.adminUpdateSubscription(
        payment.organizationId,
        {
          planId: payment.planId,
          status: 'ACTIVE',
        }
      );
    }

    return { ok: true };
  }
}
