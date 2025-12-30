import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionRepository } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { Organization, PaymentProvider, PaymentStatus } from '@prisma/client';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { PlansService } from '@gitroom/nestjs-libraries/database/prisma/plans/plans.service';
import { PlanPaymentRepository } from '@gitroom/nestjs-libraries/database/prisma/plans/plan-payment.repository';

const LEGACY_TIER_MAP: Record<string, string> = {
  FREE: 'FREE',
  STANDARD: 'BASIC',
  TEAM: 'BASIC',
  PRO: 'ENTERPRISE',
  ULTIMATE: 'ENTERPRISE',
};

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly _subscriptionRepository: SubscriptionRepository,
    private readonly _integrationService: IntegrationService,
    private readonly _organizationService: OrganizationService,
    private readonly _plansService: PlansService,
    private readonly _planPaymentRepository: PlanPaymentRepository
  ) {}

  private normalizePlanKey(key?: string | null) {
    if (!key) {
      return 'FREE';
    }
    return key.trim().toUpperCase();
  }

  private resolveLegacyPlanKey(tier?: string | null) {
    const normalized = this.normalizePlanKey(tier || 'FREE');
    return LEGACY_TIER_MAP[normalized] || normalized;
  }

  private computeEndsAt(start: Date, durationDays: number) {
    return dayjs(start).add(durationDays, 'day').toDate();
  }

  private computeTrialEndsAt(start: Date, plan?: { trialEnabled: boolean; trialDays: number }) {
    if (!plan || !plan.trialEnabled || plan.trialDays <= 0) {
      return null;
    }
    return dayjs(start).add(plan.trialDays, 'day').toDate();
  }

  private async ensureFreePlanUsage(
    organizationId: string,
    plan: { id: string; key: string; currency?: string | null },
    subscriptionId?: string | null
  ) {
    const planKey = this.normalizePlanKey(plan.key);
    if (planKey !== 'FREE') {
      return;
    }

    const hasFreePayment =
      await this._planPaymentRepository.hasPaidPaymentForPlanKey(
        organizationId,
        'FREE'
      );
    if (hasFreePayment) {
      return;
    }

    await this._planPaymentRepository.createPayment({
      organizationId,
      planId: plan.id,
      subscriptionId: subscriptionId || null,
      status: PaymentStatus.PAID,
      amount: 0,
      currency: plan.currency || 'IDR',
      provider: PaymentProvider.MANUAL,
      merchantOrderId: `FREE-${makeId(12)}`,
      paymentMethod: 'FREE_AUTO',
    });
  }

  getSubscriptionByOrganizationId(organizationId: string) {
    return this.ensureSubscriptionForOrg(organizationId);
  }

  getSubscription(organizationId: string) {
    return this.ensureSubscriptionForOrg(organizationId);
  }

  async ensureSubscriptionForOrg(organizationId: string) {
    const existing = await this._subscriptionRepository.getSubscriptionByOrganizationId(
      organizationId
    );

    if (existing?.planId) {
      return existing;
    }

    const plan =
      (await this._plansService.getPlanByKey('FREE')) ||
      (await this._plansService.getDefaultPlan());
    if (!plan) {
      return existing || null;
    }

    const startsAt = new Date();
    const trialEndsAt = this.computeTrialEndsAt(startsAt, plan);
    const status = trialEndsAt ? 'TRIAL' : 'ACTIVE';
    const endsAt = this.computeEndsAt(startsAt, plan.durationDays);

    await this._subscriptionRepository.upsertSubscription(organizationId, {
      planId: plan.id,
      status,
      startsAt,
      endsAt,
      trialEndsAt,
      canceledAt: null,
    });

    const created = await this._subscriptionRepository.getSubscriptionByOrganizationId(
      organizationId
    );
    if (created?.plan) {
      await this.ensureFreePlanUsage(organizationId, created.plan, created.id);
    }

    return created;
  }

  async getPlanForOrg(organizationId: string) {
    const access = await this.getSubscriptionAccessForOrg(organizationId);
    return access.accessPlan;
  }

  async getSubscriptionAccessForOrg(organizationId: string) {
    const subscription = await this.ensureSubscriptionForOrg(organizationId);
    const plan = subscription?.plan || (await this._plansService.getDefaultPlan());
    let accessPlan = plan;
    let billingBlocked = false;

    if (subscription?.status === 'PENDING') {
      if (plan?.trialEnabled) {
        const freePlan = await this._plansService.getPlanByKey('FREE');
        accessPlan = freePlan || (await this._plansService.getDefaultPlan());
      } else {
        accessPlan = null;
        billingBlocked = true;
      }
    }

    const planKey = plan?.key ? this.normalizePlanKey(plan.key) : 'FREE';
    const isFreeExpired =
      planKey === 'FREE' &&
      Boolean(subscription?.endsAt) &&
      dayjs(subscription!.endsAt!).isBefore(dayjs());

    if (isFreeExpired) {
      accessPlan = null;
      billingBlocked = true;
    }

    return {
      subscription,
      plan,
      accessPlan,
      billingBlocked,
    };
  }

  useCredit<T>(organization: Organization, type = 'ai_images', func: () => Promise<T>) : Promise<T> {
    return this._subscriptionRepository.useCredit(organization, type, func);
  }

  getCode(code: string) {
    return this._subscriptionRepository.getCode(code);
  }

  updateAccount(userId: string, account: string) {
    return this._subscriptionRepository.updateAccount(userId, account);
  }

  getUserAccount(userId: string) {
    return this._subscriptionRepository.getUserAccount(userId);
  }

  async deleteSubscription(customerId: string) {
    await this._subscriptionRepository.deleteSubscriptionByCustomerId(customerId);
    return true;
  }

  updateCustomerId(organizationId: string, customerId: string) {
    return this._subscriptionRepository.updateCustomerId(
      organizationId,
      customerId
    );
  }

  async checkSubscription(organizationId: string, subscriptionId: string) {
    return await this._subscriptionRepository.checkSubscription(
      organizationId,
      subscriptionId
    );
  }

  updateConnectedStatus(account: string, accountCharges: boolean) {
    return this._subscriptionRepository.updateConnectedStatus(
      account,
      accountCharges
    );
  }

  async modifySubscription(
    customerId: string,
    totalChannels: number,
    billing: string
  ) {
    if (!customerId) {
      return false;
    }

    const getOrgByCustomerId =
      await this._subscriptionRepository.getOrganizationByCustomerId(
        customerId
      );

    if (!getOrgByCustomerId) {
      return false;
    }

    const currentTotalChannels = (
      await this._integrationService.getIntegrationsList(
        getOrgByCustomerId?.id!
      )
    ).filter((f) => !f.disabled);

    if (currentTotalChannels.length > totalChannels) {
      await this._integrationService.disableIntegrations(
        getOrgByCustomerId?.id!,
        currentTotalChannels.length - totalChannels
      );
    }

    return true;
  }

  async createOrUpdateSubscription(
    isTrailing: boolean,
    identifier: string,
    customerId: string,
    totalChannels: number,
    billing: string,
    period: 'MONTHLY' | 'YEARLY',
    cancelAt: number | null,
    code?: string,
    org?: string
  ) {
    if (!code) {
      try {
        const load = await this.modifySubscription(
          customerId,
          totalChannels,
          billing
        );
        if (!load) {
          return {};
        }
      } catch (e) {
        return {};
      }
    }

    const findOrg = org
      ? { id: org }
      : await this._subscriptionRepository.getOrganizationByCustomerId(
          customerId
        );

    if (!findOrg) {
      return {};
    }

    const planKey = this.resolveLegacyPlanKey(billing);
    const plan = await this._plansService.getPlanByKey(planKey);
    const fallbackPlan = plan || (await this._plansService.getDefaultPlan());
    if (!fallbackPlan) {
      return {};
    }

    const startsAt = new Date();
    const trialEndsAt = isTrailing
      ? this.computeTrialEndsAt(startsAt, fallbackPlan)
      : null;
    const status = trialEndsAt ? 'TRIAL' : 'ACTIVE';
    const endsAt = this.computeEndsAt(startsAt, fallbackPlan.durationDays);

    await this._subscriptionRepository.upsertSubscription(findOrg.id, {
      planId: fallbackPlan.id,
      status,
      startsAt,
      endsAt,
      trialEndsAt,
      canceledAt: cancelAt ? new Date(cancelAt * 1000) : null,
    });

    return {};
  }

  async checkCredits(organization: Organization, checkType = 'ai_images') {
    const access = await this.getSubscriptionAccessForOrg(organization.id);
    const subscription = access.subscription;
    const plan = access.accessPlan;
    const limit = plan?.postLimitMonthlyUnlimited
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, Number(plan?.postLimitMonthly ?? 0));

    if (!limit) {
      return { credits: 0 };
    }

    let date = dayjs(subscription?.createdAt || organization.createdAt || new Date());
    while (date.isBefore(dayjs())) {
      date = date.add(1, 'month');
    }

    const checkFromMonth = date.subtract(1, 'month');

    const totalUse = await this._subscriptionRepository.getCreditsFrom(
      organization.id,
      checkFromMonth,
      checkType
    );

    return {
      credits: limit - totalUse,
    };
  }

  async lifeTime(orgId: string, identifier: string, subscription: any) {
    const planKey = this.resolveLegacyPlanKey(String(subscription));
    const plan = await this._plansService.getPlanByKey(planKey);
    if (!plan) {
      return {};
    }

    return this.createOrUpdateSubscription(
      false,
      identifier,
      identifier,
      plan.channelLimit || 0,
      plan.key,
      'YEARLY',
      null,
      identifier,
      orgId
    );
  }

  async addSubscription(orgId: string, userId: string, subscription: any) {
    const planKey = this.resolveLegacyPlanKey(String(subscription));
    const plan = await this._plansService.getPlanByKey(planKey);
    if (!plan) {
      return {};
    }

    await this._subscriptionRepository.setCustomerId(orgId, userId);
    return this.createOrUpdateSubscription(
      false,
      makeId(5),
      userId,
      plan.channelLimit || 0,
      plan.key,
      'MONTHLY',
      null,
      undefined,
      orgId
    );
  }

  async adminUpdateSubscription(
    organizationId: string,
    data: {
      planId?: string;
      status?: 'PENDING' | 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELED';
      endsAt?: string;
      trialEndsAt?: string;
    }
  ) {
    const org = await this._organizationService.getOrgById(organizationId);
    if (!org) {
      throw new Error('Organization not found');
    }

    const current = await this._subscriptionRepository.getSubscriptionByOrganizationId(
      organizationId
    );
    const plan = data.planId
      ? await this._plansService.getPlanById(data.planId)
      : current?.plan || (await this._plansService.getDefaultPlan());

    if (!plan) {
      throw new Error('Plan not found');
    }

    const startsAt = new Date();
    const trialEndsAt = data.trialEndsAt
      ? new Date(data.trialEndsAt)
      : this.computeTrialEndsAt(startsAt, plan);
    const endsAt = data.endsAt
      ? new Date(data.endsAt)
      : this.computeEndsAt(startsAt, plan.durationDays);
    const status = data.status || (trialEndsAt ? 'TRIAL' : 'ACTIVE');

    const planKey = this.normalizePlanKey(plan.key);
    if (planKey === 'FREE') {
      const hasFreePayment =
        await this._planPaymentRepository.hasPaidPaymentForPlanKey(
          organizationId,
          'FREE'
        );
      const currentKey = current?.plan?.key
        ? this.normalizePlanKey(current.plan.key)
        : null;
      const freeExpired =
        current?.endsAt && dayjs(current.endsAt).isBefore(dayjs());
      const isReactivation =
        hasFreePayment && (currentKey !== 'FREE' || freeExpired);
      const isActivation = status === 'ACTIVE' || status === 'TRIAL';

      if (isReactivation && isActivation) {
        throw new BadRequestException('Free plan already used');
      }
    }

    await this._subscriptionRepository.upsertSubscription(organizationId, {
      planId: plan.id,
      status,
      startsAt,
      endsAt,
      trialEndsAt,
      canceledAt: status === 'CANCELED' ? new Date() : null,
    });

    await this.ensureFreePlanUsage(organizationId, plan, current?.id || null);

    return { success: true };
  }
}
