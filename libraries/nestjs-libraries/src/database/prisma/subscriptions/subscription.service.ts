import { Injectable } from '@nestjs/common';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { SubscriptionRepository } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { Organization, Period, SubscriptionTier } from '@prisma/client';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { PlansService } from '@gitroom/nestjs-libraries/database/prisma/plans/plans.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly _subscriptionRepository: SubscriptionRepository,
    private readonly _integrationService: IntegrationService,
    private readonly _organizationService: OrganizationService,
    private readonly _plansService: PlansService
  ) {}

  getSubscriptionByOrganizationId(organizationId: string) {
    return this._subscriptionRepository.getSubscriptionByOrganizationId(
      organizationId
    );
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
    await this.modifySubscription(
      customerId,
      pricing.FREE.channel || 0,
      'FREE'
    );
    return this._subscriptionRepository.deleteSubscriptionByCustomerId(
      customerId
    );
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
    billing: 'FREE' | 'STANDARD' | 'PRO'
  ) {
    if (!customerId) {
      return false;
    }

    const getOrgByCustomerId =
      await this._subscriptionRepository.getOrganizationByCustomerId(
        customerId
      );

    const getCurrentSubscription =
      (await this._subscriptionRepository.getSubscriptionByCustomerId(
        customerId
      ))!;

    if (
      !getOrgByCustomerId ||
      (getCurrentSubscription && getCurrentSubscription?.isLifetime)
    ) {
      return false;
    }

    const from = pricing[getCurrentSubscription?.subscriptionTier || 'FREE'];
    const to = pricing[billing];

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

    if (from.team_members && !to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        getOrgByCustomerId?.id!,
        true
      );
    }

    if (!from.team_members && to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        getOrgByCustomerId?.id!,
        false
      );
    }

    if (billing === 'FREE') {
      await this._integrationService.changeActiveCron(getOrgByCustomerId?.id!);
    }

    return true;

    // if (to.faq < from.faq) {
    //   await this._faqRepository.deleteFAQs(getCurrentSubscription?.organizationId, from.faq - to.faq);
    // }
    // if (to.categories < from.categories) {
    //   await this._categoriesRepository.deleteCategories(getCurrentSubscription?.organizationId, from.categories - to.categories);
    // }
    // if (to.integrations < from.integrations) {
    //   await this._integrationsRepository.deleteIntegrations(getCurrentSubscription?.organizationId, from.integrations - to.integrations);
    // }
    // if (to.user < from.user) {
    //   await this._integrationsRepository.deleteUsers(getCurrentSubscription?.organizationId, from.user - to.user);
    // }
    // if (to.domains < from.domains) {
    //   await this._settingsService.deleteDomainByOrg(getCurrentSubscription?.organizationId);
    //   await this._organizationRepository.changePowered(getCurrentSubscription?.organizationId);
    // }
  }

  async createOrUpdateSubscription(
    isTrailing: boolean,
    identifier: string,
    customerId: string,
    totalChannels: number,
    billing: 'STANDARD' | 'PRO',
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
    return this._subscriptionRepository.createOrUpdateSubscription(
      isTrailing,
      identifier,
      customerId,
      totalChannels,
      billing,
      period,
      cancelAt,
      code,
      org ? { id: org } : undefined
    );
  }

  async getSubscription(organizationId: string) {
    return this._subscriptionRepository.getSubscription(organizationId);
  }

  async checkCredits(organization: Organization, checkType = 'ai_images') {
    // @ts-ignore
    const type = organization?.subscription?.subscriptionTier || 'FREE';

    if (type === 'FREE') {
      return { credits: 0 };
    }

    // @ts-ignore
    let date = dayjs(organization.subscription.createdAt);
    while (date.isBefore(dayjs())) {
      date = date.add(1, 'month');
    }

    const checkFromMonth = date.subtract(1, 'month');
    const imageGenerationCount = checkType === 'ai_images' ? pricing[type].image_generation_count : pricing[type].generate_videos

    const totalUse = await this._subscriptionRepository.getCreditsFrom(
      organization.id,
      checkFromMonth,
      checkType
    );

    return {
      credits: imageGenerationCount - totalUse,
    };
  }

  async lifeTime(orgId: string, identifier: string, subscription: any) {
    const plan = await this._plansService.getPlanByTier(subscription);
    return this.createOrUpdateSubscription(
      false,
      identifier,
      identifier,
      plan.pricing.channel!,
      subscription,
      'YEARLY',
      null,
      identifier,
      orgId
    );
  }

  async addSubscription(orgId: string, userId: string, subscription: any) {
    const plan = await this._plansService.getPlanByTier(subscription);
    await this._subscriptionRepository.setCustomerId(orgId, userId);
    return this.createOrUpdateSubscription(
      false,
      makeId(5),
      userId,
      plan.pricing.channel!,
      subscription,
      'MONTHLY',
      null,
      undefined,
      orgId
    );
  }

  private async applyTierChange(
    organizationId: string,
    fromTier: SubscriptionTier | 'FREE',
    toTier: SubscriptionTier | 'FREE',
    totalChannels: number
  ) {
    const from = pricing[fromTier] || pricing.FREE;
    const to = pricing[toTier] || pricing.FREE;

    const currentTotalChannels = (
      await this._integrationService.getIntegrationsList(organizationId)
    ).filter((f) => !f.disabled);

    if (currentTotalChannels.length > totalChannels) {
      await this._integrationService.disableIntegrations(
        organizationId,
        currentTotalChannels.length - totalChannels
      );
    }

    if (from.team_members && !to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        organizationId,
        true
      );
    }

    if (!from.team_members && to.team_members) {
      await this._organizationService.disableOrEnableNonSuperAdminUsers(
        organizationId,
        false
      );
    }

    if (toTier === 'FREE') {
      await this._integrationService.changeActiveCron(organizationId);
    }
  }

  async adminUpdateSubscription(
    organizationId: string,
    data: {
      subscriptionTier: SubscriptionTier | 'FREE';
      totalChannels?: number;
      period?: Period;
      isLifetime?: boolean;
      allowTrial?: boolean;
      isTrailing?: boolean;
    }
  ) {
    const org = await this._organizationService.getOrgById(organizationId);
    if (!org) {
      throw new Error('Organization not found');
    }

    const current =
      await this._subscriptionRepository.getSubscription(organizationId);
    const fromTier = current?.subscriptionTier || 'FREE';
    const plan = await this._plansService.getPlanByTier(data.subscriptionTier);
    const resolvedTotalChannels = Math.max(
      0,
      typeof data.totalChannels === 'number'
        ? data.totalChannels
        : plan.pricing.channel || 0
    );
    const period = data.period || current?.period || 'MONTHLY';
    const isLifetime = data.isLifetime ?? current?.isLifetime ?? false;

    await this.applyTierChange(
      organizationId,
      fromTier,
      data.subscriptionTier,
      resolvedTotalChannels
    );

    if (data.subscriptionTier === 'FREE') {
      await this._subscriptionRepository.archiveAdminSubscription(
        organizationId
      );
    } else {
      await this._subscriptionRepository.upsertAdminSubscription(
        organizationId,
        {
          subscriptionTier: data.subscriptionTier,
          totalChannels: resolvedTotalChannels,
          period,
          isLifetime,
          identifier: current?.identifier || 'manual',
          cancelAt: current?.cancelAt || null,
        }
      );
    }

    if (data.allowTrial !== undefined || data.isTrailing !== undefined) {
      await this._organizationService.updateTrialFlags(organizationId, {
        allowTrial: data.allowTrial,
        isTrailing: data.isTrailing,
      });
    }

    return { success: true };
  }
}
