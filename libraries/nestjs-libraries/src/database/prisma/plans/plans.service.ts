import { Injectable } from '@nestjs/common';
import {
  pricing,
  PricingInnerInterface,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { PlanOverrideRepository } from './plan-override.repository';

const PLAN_TIERS = ['FREE', 'STANDARD', 'TEAM', 'PRO', 'ULTIMATE'] as const;
export type PlanTier = typeof PLAN_TIERS[number];

export type PlanConfig = {
  tier: PlanTier;
  visible: boolean;
  pricing: PricingInnerInterface;
};

@Injectable()
export class PlansService {
  constructor(private readonly _planOverrideRepo: PlanOverrideRepository) {}

  private normalizeTier(tier: string): PlanTier {
    const upper = tier.trim().toUpperCase();
    const matched = PLAN_TIERS.find((t) => t === upper);
    if (!matched) {
      throw new Error(`Unknown plan tier: ${tier}`);
    }
    return matched;
  }

  private mergePlan(
    tier: PlanTier,
    override?: {
      visible: boolean;
      monthPrice: number | null;
      yearPrice: number | null;
      channelLimit: number | null;
    }
  ): PlanConfig {
    const base = pricing[tier];
    const merged: PricingInnerInterface = {
      ...base,
      current: tier,
      month_price:
        override?.monthPrice === null || override?.monthPrice === undefined
          ? base.month_price
          : override.monthPrice,
      year_price:
        override?.yearPrice === null || override?.yearPrice === undefined
          ? base.year_price
          : override.yearPrice,
      channel:
        override?.channelLimit === null || override?.channelLimit === undefined
          ? base.channel
          : override.channelLimit,
    };

    return {
      tier,
      visible: override?.visible ?? true,
      pricing: merged,
    };
  }

  async listPlans(includeHidden = true) {
    const overrides = await this._planOverrideRepo.listOverrides();
    const overrideMap = new Map(
      overrides.map((item) => [
        item.tier,
        {
          visible: item.visible,
          monthPrice: item.monthPrice,
          yearPrice: item.yearPrice,
          channelLimit: item.channelLimit,
        },
      ])
    );

    const plans = PLAN_TIERS.map((tier) =>
      this.mergePlan(tier, overrideMap.get(tier))
    );

    return includeHidden ? plans : plans.filter((plan) => plan.visible);
  }

  async getPlanByTier(tier: PlanTier) {
    const overrides = await this._planOverrideRepo.listOverrides();
    const override = overrides.find((item) => item.tier === tier);
    return this.mergePlan(tier, override || undefined);
  }

  async updatePlan(
    tier: string,
    data: {
      visible?: boolean;
      monthPrice?: number | null;
      yearPrice?: number | null;
      channelLimit?: number | null;
    }
  ) {
    const normalized = this.normalizeTier(tier);
    await this._planOverrideRepo.upsertOverride(normalized, data);
    return this.getPlanByTier(normalized);
  }

  async resetPlan(tier: string) {
    const normalized = this.normalizeTier(tier);
    await this._planOverrideRepo.deleteOverride(normalized);
    return this.getPlanByTier(normalized);
  }
}
