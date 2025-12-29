import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { StripeService } from '@gitroom/nestjs-libraries/services/stripe.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization, User } from '@prisma/client';
import { BillingSubscribeDto } from '@gitroom/nestjs-libraries/dtos/billing/billing.subscribe.dto';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { Request } from 'express';
import { Nowpayments } from '@gitroom/nestjs-libraries/crypto/nowpayments';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { PlansService } from '@gitroom/nestjs-libraries/database/prisma/plans/plans.service';
import { PlanPaymentRepository } from '@gitroom/nestjs-libraries/database/prisma/plans/plan-payment.repository';
import { DuitkuService } from '@gitroom/nestjs-libraries/services/duitku.service';

@ApiTags('Billing')
@Controller('/billing')
export class BillingController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _stripeService: StripeService,
    private _notificationService: NotificationService,
    private _nowpayments: Nowpayments,
    private _plansService: PlansService,
    private _planPaymentRepository: PlanPaymentRepository,
    private _duitkuService: DuitkuService
  ) {}

  @Get('/check/:id')
  async checkId(
    @GetOrgFromRequest() org: Organization,
    @Param('id') body: string
  ) {
    return {
      status: await this._stripeService.checkSubscription(org.id, body),
    };
  }

  @Get('/check-discount')
  async checkDiscount(@GetOrgFromRequest() org: Organization) {
    return {
      offerCoupon: !(await this._stripeService.checkDiscount(org.paymentId))
        ? false
        : AuthService.signJWT({ discount: true }),
    };
  }

  @Post('/apply-discount')
  async applyDiscount(@GetOrgFromRequest() org: Organization) {
    await this._stripeService.applyDiscount(org.paymentId);
  }

  @Post('/finish-trial')
  async finishTrial(@GetOrgFromRequest() org: Organization) {
    try {
      await this._stripeService.finishTrial(org.paymentId);
    } catch (err) {}
    return {
      finish: true,
    };
  }

  @Get('/is-trial-finished')
  async isTrialFinished(@GetOrgFromRequest() org: Organization) {
    return {
      finished: !org.isTrailing,
    };
  }

  @Post('/subscribe')
  async subscribe(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: BillingSubscribeDto,
    @Req() req: Request
  ) {
    if (body.planId || body.planKey) {
      return this._duitkuService.createPayment({
        organizationId: org.id,
        userId: user.id,
        planId: body.planId,
        planKey: body.planKey,
        paymentMethod: body.paymentMethod,
        returnUrl: body.returnUrl,
        customerName: user.name || user.email,
        customerEmail: user.email,
      });
    }

    if (!body.period || !body.billing) {
      throw new BadRequestException('Missing billing period or tier');
    }

    const uniqueId = req?.cookies?.track;
    return this._stripeService.subscribe(
      uniqueId,
      org.id,
      user.id,
      body,
      org.allowTrial
    );
  }

  @Get('/portal')
  async modifyPayment(@GetOrgFromRequest() org: Organization) {
    const customer = await this._stripeService.getCustomerByOrganizationId(
      org.id
    );
    const { url } = await this._stripeService.createBillingPortalLink(customer);
    return {
      portal: url,
    };
  }

  @Get('/')
  getCurrentBilling(@GetOrgFromRequest() org: Organization) {
    return this._subscriptionService.getSubscriptionByOrganizationId(org.id);
  }

  @Get('/plans')
  async getPlans(@GetOrgFromRequest() org: Organization) {
    return {
      plans: await this._plansService.listPlans(false),
    };
  }

  @Get('/duitku/methods')
  async getDuitkuMethods(
    @Query('planId') planId?: string,
    @Query('amount') amount?: string
  ) {
    if (planId) {
      const plan = await this._plansService.getPlanById(planId);
      if (!plan) {
        throw new BadRequestException('Plan not found');
      }
      return {
        methods: await this._duitkuService.getPaymentMethods(plan.price),
      };
    }

    if (!amount) {
      throw new BadRequestException('Amount is required');
    }

    return {
      methods: await this._duitkuService.getPaymentMethods(Number(amount)),
    };
  }

  @Get('/invoice')
  async getInvoice(@GetOrgFromRequest() org: Organization) {
    const subscription =
      await this._subscriptionService.getSubscriptionByOrganizationId(org.id);
    const payment =
      await this._planPaymentRepository.getLatestPendingPayment(org.id);
    const plan =
      payment?.plan ||
      subscription?.plan ||
      (await this._plansService.getDefaultPlan());

    return {
      pending: subscription?.status === 'PENDING',
      amount: payment?.amount ?? plan?.price ?? 0,
      currency: payment?.currency || plan?.currency || 'IDR',
      paymentMethod: payment?.paymentMethod || null,
      provider: payment?.provider || null,
      checkoutUrl: payment?.checkoutUrl || null,
      expiresAt: payment?.expiresAt || null,
      plan,
    };
  }

  @Post('/cancel')
  async cancel(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: { feedback: string }
  ) {
    await this._notificationService.sendEmail(
      process.env.EMAIL_FROM_ADDRESS,
      'Subscription Cancelled',
      `Organization ${org.name} has cancelled their subscription because: ${body.feedback}`,
      user.email
    );

    return this._stripeService.setToCancel(org.id);
  }

  @Post('/prorate')
  prorate(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BillingSubscribeDto
  ) {
    return this._stripeService.prorate(org.id, body);
  }

  @Post('/lifetime')
  async lifetime(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { code: string }
  ) {
    return this._stripeService.lifetimeDeal(org.id, body.code);
  }

  @Post('/add-subscription')
  async addSubscription(
    @Body() body: { subscription: string },
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization
  ) {
    if (!user.isSuperAdmin) {
      throw new Error('Unauthorized');
    }

    await this._subscriptionService.addSubscription(
      org.id,
      user.id,
      body.subscription
    );
  }

  @Get('/crypto')
  async crypto(@GetOrgFromRequest() org: Organization) {
    return this._nowpayments.createPaymentPage(org.id);
  }
}
