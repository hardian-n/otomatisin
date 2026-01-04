import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  DuitkuMode,
  PaymentProvider,
  PaymentStatus,
  User,
} from '@prisma/client';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { PlanPaymentRepository } from '@gitroom/nestjs-libraries/database/prisma/plans/plan-payment.repository';
import { PaymentSettingsRepository } from '@gitroom/nestjs-libraries/database/prisma/payments/payment-settings.repository';
import { DuitkuService } from '@gitroom/nestjs-libraries/services/duitku.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';

@ApiTags('Admin')
@Controller('/admin/payments')
export class AdminPaymentsController {
  constructor(
    private readonly _planPaymentRepository: PlanPaymentRepository,
    private readonly _paymentSettingsRepository: PaymentSettingsRepository,
    private readonly _duitkuService: DuitkuService,
    private readonly _subscriptionService: SubscriptionService
  ) {}

  private ensureAdmin(user: User) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }
  }

  @Get()
  async listPayments(
    @GetUserFromRequest() user: User,
    @Query('status') status?: string,
    @Query('orgId') orgId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string
  ) {
    this.ensureAdmin(user);

    const resolvedSkip = Math.max(Number(skip) || 0, 0);
    const resolvedTake = Math.min(Math.max(Number(take) || 50, 1), 200);
    const normalizedStatus =
      status && Object.values(PaymentStatus).includes(status as PaymentStatus)
        ? (status as PaymentStatus)
        : undefined;

    const payments = await this._planPaymentRepository.listPayments({
      status: normalizedStatus,
      orgId: orgId?.trim() || undefined,
      skip: resolvedSkip,
      take: resolvedTake,
    });

      return payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      uniqueCode: payment.uniqueCode,
      provider: payment.provider,
      merchantOrderId: payment.merchantOrderId,
      reference: payment.reference,
      paymentMethod: payment.paymentMethod,
      checkoutUrl: payment.checkoutUrl,
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      organization: payment.organization
        ? {
            id: payment.organization.id,
            name: payment.organization.name,
          }
        : null,
      plan: payment.plan
        ? {
            id: payment.plan.id,
            key: payment.plan.key,
            name: payment.plan.name,
            price: payment.plan.price,
            currency: payment.plan.currency,
          }
        : null,
      user: payment.user
        ? {
            id: payment.user.id,
            name: payment.user.name,
            email: payment.user.email,
          }
        : null,
    }));
  }

  @Get('/duitku')
  async getDuitkuSettings(@GetUserFromRequest() user: User) {
    this.ensureAdmin(user);

    const settings =
      await this._paymentSettingsRepository.getProviderSettings(
        PaymentProvider.DUITKU
      );

    return {
      mode: settings?.mode || DuitkuMode.SANDBOX,
      merchantCode: settings?.merchantCode || null,
      apiKey: settings?.apiKey || null,
    };
  }

  @Post('/duitku')
  async saveDuitkuSettings(
    @GetUserFromRequest() user: User,
    @Body()
    body: {
      mode?: DuitkuMode;
      merchantCode?: string | null;
      apiKey?: string | null;
    }
  ) {
    this.ensureAdmin(user);

    if (body.mode && !Object.values(DuitkuMode).includes(body.mode)) {
      throw new BadRequestException('Invalid Duitku mode');
    }

    const sanitizedMerchant =
      body.merchantCode !== undefined
        ? body.merchantCode?.trim() || null
        : undefined;
    const sanitizedApiKey =
      body.apiKey !== undefined ? body.apiKey?.trim() || null : undefined;

    const saved = await this._paymentSettingsRepository.upsertProviderSettings(
      PaymentProvider.DUITKU,
      {
        mode: body.mode,
        merchantCode: sanitizedMerchant,
        apiKey: sanitizedApiKey,
      }
    );

    return {
      mode: saved.mode,
      merchantCode: saved.merchantCode,
      apiKey: saved.apiKey,
    };
  }

  @Get('/manual')
  async getManualSettings(@GetUserFromRequest() user: User) {
    this.ensureAdmin(user);

    const settings =
      await this._paymentSettingsRepository.getProviderSettings(
        PaymentProvider.MANUAL
      );

    return {
      bankName: settings?.bankName || null,
      bankAccountNumber: settings?.bankAccountNumber || null,
      bankAccountName: settings?.bankAccountName || null,
      uniqueCodeEnabled: settings?.uniqueCodeEnabled ?? true,
      uniqueCodeMin: settings?.uniqueCodeMin ?? 1,
      uniqueCodeMax: settings?.uniqueCodeMax ?? 999,
    };
  }

  @Post('/manual')
  async saveManualSettings(
    @GetUserFromRequest() user: User,
    @Body()
    body: {
      bankName?: string | null;
      bankAccountNumber?: string | null;
      bankAccountName?: string | null;
      uniqueCodeEnabled?: boolean | null;
      uniqueCodeMin?: number | null;
      uniqueCodeMax?: number | null;
    }
  ) {
    this.ensureAdmin(user);

    const bankName =
      body.bankName !== undefined ? body.bankName?.trim() || null : undefined;
    const bankAccountNumber =
      body.bankAccountNumber !== undefined
        ? body.bankAccountNumber?.trim() || null
        : undefined;
    const bankAccountName =
      body.bankAccountName !== undefined
        ? body.bankAccountName?.trim() || null
        : undefined;
    const uniqueCodeEnabled =
      body.uniqueCodeEnabled !== undefined && body.uniqueCodeEnabled !== null
        ? Boolean(body.uniqueCodeEnabled)
        : undefined;
    const uniqueCodeMin =
      body.uniqueCodeMin !== undefined && body.uniqueCodeMin !== null
        ? Number(body.uniqueCodeMin)
        : undefined;
    const uniqueCodeMax =
      body.uniqueCodeMax !== undefined && body.uniqueCodeMax !== null
        ? Number(body.uniqueCodeMax)
        : undefined;

    const hasMin = uniqueCodeMin !== undefined;
    const hasMax = uniqueCodeMax !== undefined;
    if (hasMin && (!Number.isFinite(uniqueCodeMin) || uniqueCodeMin < 0 || uniqueCodeMin > 999)) {
      throw new BadRequestException('Invalid unique code minimum');
    }
    if (hasMax && (!Number.isFinite(uniqueCodeMax) || uniqueCodeMax < 0 || uniqueCodeMax > 999)) {
      throw new BadRequestException('Invalid unique code maximum');
    }
    if (hasMin && hasMax && uniqueCodeMin > uniqueCodeMax) {
      throw new BadRequestException('Unique code minimum must be <= maximum');
    }

    const saved = await this._paymentSettingsRepository.upsertProviderSettings(
      PaymentProvider.MANUAL,
      {
        bankName,
        bankAccountNumber,
        bankAccountName,
        uniqueCodeEnabled,
        uniqueCodeMin,
        uniqueCodeMax,
      }
    );

    return {
      bankName: saved.bankName,
      bankAccountNumber: saved.bankAccountNumber,
      bankAccountName: saved.bankAccountName,
      uniqueCodeEnabled: saved.uniqueCodeEnabled ?? true,
      uniqueCodeMin: saved.uniqueCodeMin ?? 1,
      uniqueCodeMax: saved.uniqueCodeMax ?? 999,
    };
  }

  @Patch('/:id')
  async updatePaymentStatus(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: { status?: PaymentStatus }
  ) {
    this.ensureAdmin(user);

    if (!body.status) {
      throw new BadRequestException('Status is required');
    }

    if (!Object.values(PaymentStatus).includes(body.status)) {
      throw new BadRequestException('Invalid payment status');
    }

    return this._duitkuService.markPaymentStatus(id, body.status);
  }

  @Delete('/:id')
  async deletePayment(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.ensureAdmin(user);

    const payment = await this._planPaymentRepository.getPaymentById(id);
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Paid payments cannot be deleted');
    }

    if (payment.status === PaymentStatus.PENDING) {
      const hasOtherPending =
        await this._planPaymentRepository.hasOtherPendingPayment(
          payment.organizationId,
          payment.id
        );

      if (!hasOtherPending) {
        const previousSnapshot =
          (payment as any)?.requestPayload?.previousSubscription;
        await this._subscriptionService.restoreSubscriptionSnapshot(
          payment.organizationId,
          previousSnapshot
        );
      }
    }

    await this._planPaymentRepository.deletePayment(id);
    return { ok: true };
  }
}
