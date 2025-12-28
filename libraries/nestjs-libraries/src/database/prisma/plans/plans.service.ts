import { Injectable, OnModuleInit } from '@nestjs/common';
import { PlanRepository } from '@gitroom/nestjs-libraries/database/prisma/plans/plan.repository';

const DEFAULT_LIMITS = {
  channelLimit: 3,
  postLimitMonthly: 3,
  memberLimit: 3,
  storageLimitMb: 3,
  inboxLimitMonthly: 3,
  autoreplyLimit: 3,
};

const DEFAULT_PLANS = [
  {
    key: 'FREE',
    name: 'Free',
    price: 0,
    isDefault: true,
  },
  {
    key: 'BASIC',
    name: 'Basic',
    price: 20000,
    isDefault: false,
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    price: 20000,
    isDefault: false,
  },
] as const;

@Injectable()
export class PlansService implements OnModuleInit {
  constructor(private readonly _planRepository: PlanRepository) {}

  async onModuleInit() {
    await this.ensureDefaultPlans();
  }

  private normalizeKey(key: string) {
    return key.trim().toUpperCase();
  }

  private toPlanInput(data: {
    key: string;
    name: string;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    durationDays?: number | null;
    trialEnabled?: boolean;
    trialDays?: number | null;
    isActive?: boolean;
    isDefault?: boolean;
    channelLimit?: number | null;
    channelLimitUnlimited?: boolean;
    postLimitMonthly?: number | null;
    postLimitMonthlyUnlimited?: boolean;
    memberLimit?: number | null;
    memberLimitUnlimited?: boolean;
    storageLimitMb?: number | null;
    storageLimitMbUnlimited?: boolean;
    inboxLimitMonthly?: number | null;
    inboxLimitMonthlyUnlimited?: boolean;
    autoreplyLimit?: number | null;
    autoreplyLimitUnlimited?: boolean;
  }) {
    const key = this.normalizeKey(data.key);
    return {
      key,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      price: Math.max(0, Number(data.price ?? 20000)),
      currency: (data.currency || 'IDR').toUpperCase(),
      durationDays: Math.max(1, Number(data.durationDays ?? 30)),
      trialEnabled: data.trialEnabled ?? true,
      trialDays: Math.max(0, Number(data.trialDays ?? 3)),
      isActive: data.isActive ?? true,
      isDefault: data.isDefault ?? false,
      channelLimit: data.channelLimitUnlimited
        ? null
        : Math.max(0, Number(data.channelLimit ?? DEFAULT_LIMITS.channelLimit)),
      channelLimitUnlimited: data.channelLimitUnlimited ?? false,
      postLimitMonthly: data.postLimitMonthlyUnlimited
        ? null
        : Math.max(
            0,
            Number(data.postLimitMonthly ?? DEFAULT_LIMITS.postLimitMonthly)
          ),
      postLimitMonthlyUnlimited: data.postLimitMonthlyUnlimited ?? false,
      memberLimit: data.memberLimitUnlimited
        ? null
        : Math.max(0, Number(data.memberLimit ?? DEFAULT_LIMITS.memberLimit)),
      memberLimitUnlimited: data.memberLimitUnlimited ?? false,
      storageLimitMb: data.storageLimitMbUnlimited
        ? null
        : Math.max(0, Number(data.storageLimitMb ?? DEFAULT_LIMITS.storageLimitMb)),
      storageLimitMbUnlimited: data.storageLimitMbUnlimited ?? false,
      inboxLimitMonthly: data.inboxLimitMonthlyUnlimited
        ? null
        : Math.max(
            0,
            Number(data.inboxLimitMonthly ?? DEFAULT_LIMITS.inboxLimitMonthly)
          ),
      inboxLimitMonthlyUnlimited: data.inboxLimitMonthlyUnlimited ?? false,
      autoreplyLimit: data.autoreplyLimitUnlimited
        ? null
        : Math.max(
            0,
            Number(data.autoreplyLimit ?? DEFAULT_LIMITS.autoreplyLimit)
          ),
      autoreplyLimitUnlimited: data.autoreplyLimitUnlimited ?? false,
    };
  }

  async ensureDefaultPlans() {
    const existing = await this._planRepository.listPlans(true);
    const existingKeys = new Set(existing.map((plan) => plan.key));

    for (const plan of DEFAULT_PLANS) {
      if (existingKeys.has(plan.key)) {
        continue;
      }
      await this._planRepository.createPlan(
        this.toPlanInput({
          key: plan.key,
          name: plan.name,
          price: plan.price,
          isDefault: plan.isDefault,
        })
      );
    }

    const hasDefault = existing.some((plan) => plan.isDefault);
    if (!hasDefault) {
      const free = await this._planRepository.getPlanByKey('FREE');
      if (free) {
        await this._planRepository.clearDefaultPlan();
        await this._planRepository.updatePlan(free.id, { isDefault: true });
      }
    }
  }

  listPlans(includeInactive = true) {
    return this._planRepository.listPlans(includeInactive);
  }

  async getDefaultPlan() {
    const plans = await this._planRepository.listPlans(true);
    return plans.find((plan) => plan.isDefault) || plans[0] || null;
  }

  getPlanById(id: string) {
    return this._planRepository.getPlanById(id);
  }

  getPlanByKey(key: string) {
    return this._planRepository.getPlanByKey(this.normalizeKey(key));
  }

  async createPlan(data: {
    key: string;
    name: string;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    durationDays?: number | null;
    trialEnabled?: boolean;
    trialDays?: number | null;
    isActive?: boolean;
    isDefault?: boolean;
    channelLimit?: number | null;
    channelLimitUnlimited?: boolean;
    postLimitMonthly?: number | null;
    postLimitMonthlyUnlimited?: boolean;
    memberLimit?: number | null;
    memberLimitUnlimited?: boolean;
    storageLimitMb?: number | null;
    storageLimitMbUnlimited?: boolean;
    inboxLimitMonthly?: number | null;
    inboxLimitMonthlyUnlimited?: boolean;
    autoreplyLimit?: number | null;
    autoreplyLimitUnlimited?: boolean;
  }) {
    const input = this.toPlanInput(data);
    const existing = await this._planRepository.getPlanByKey(input.key);
    if (existing) {
      throw new Error('Plan key already exists');
    }
    if (input.isDefault) {
      await this._planRepository.clearDefaultPlan();
    }
    return this._planRepository.createPlan(input);
  }

  async updatePlan(id: string, data: Partial<{
    name: string;
    description: string | null;
    price: number | null;
    currency: string | null;
    durationDays: number | null;
    trialEnabled: boolean;
    trialDays: number | null;
    isActive: boolean;
    isDefault: boolean;
    channelLimit: number | null;
    channelLimitUnlimited: boolean;
    postLimitMonthly: number | null;
    postLimitMonthlyUnlimited: boolean;
    memberLimit: number | null;
    memberLimitUnlimited: boolean;
    storageLimitMb: number | null;
    storageLimitMbUnlimited: boolean;
    inboxLimitMonthly: number | null;
    inboxLimitMonthlyUnlimited: boolean;
    autoreplyLimit: number | null;
    autoreplyLimitUnlimited: boolean;
  }>) {
    if (data.isDefault) {
      await this._planRepository.clearDefaultPlan();
    }

    const updateData: any = {
      ...(data.name ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description?.trim() || null }
        : {}),
      ...(data.price !== undefined
        ? { price: Math.max(0, Number(data.price)) }
        : {}),
      ...(data.currency ? { currency: data.currency.toUpperCase() } : {}),
      ...(data.durationDays !== undefined
        ? { durationDays: Math.max(1, Number(data.durationDays)) }
        : {}),
      ...(data.trialEnabled !== undefined
        ? { trialEnabled: data.trialEnabled }
        : {}),
      ...(data.trialDays !== undefined
        ? { trialDays: Math.max(0, Number(data.trialDays)) }
        : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
    };

    if (data.channelLimitUnlimited !== undefined) {
      updateData.channelLimitUnlimited = data.channelLimitUnlimited;
    }
    if (data.channelLimit !== undefined || data.channelLimitUnlimited !== undefined) {
      updateData.channelLimit = data.channelLimitUnlimited
        ? null
        : Math.max(0, Number(data.channelLimit ?? DEFAULT_LIMITS.channelLimit));
    }

    if (data.postLimitMonthlyUnlimited !== undefined) {
      updateData.postLimitMonthlyUnlimited = data.postLimitMonthlyUnlimited;
    }
    if (data.postLimitMonthly !== undefined || data.postLimitMonthlyUnlimited !== undefined) {
      updateData.postLimitMonthly = data.postLimitMonthlyUnlimited
        ? null
        : Math.max(
            0,
            Number(data.postLimitMonthly ?? DEFAULT_LIMITS.postLimitMonthly)
          );
    }

    if (data.memberLimitUnlimited !== undefined) {
      updateData.memberLimitUnlimited = data.memberLimitUnlimited;
    }
    if (data.memberLimit !== undefined || data.memberLimitUnlimited !== undefined) {
      updateData.memberLimit = data.memberLimitUnlimited
        ? null
        : Math.max(0, Number(data.memberLimit ?? DEFAULT_LIMITS.memberLimit));
    }

    if (data.storageLimitMbUnlimited !== undefined) {
      updateData.storageLimitMbUnlimited = data.storageLimitMbUnlimited;
    }
    if (data.storageLimitMb !== undefined || data.storageLimitMbUnlimited !== undefined) {
      updateData.storageLimitMb = data.storageLimitMbUnlimited
        ? null
        : Math.max(
            0,
            Number(data.storageLimitMb ?? DEFAULT_LIMITS.storageLimitMb)
          );
    }

    if (data.inboxLimitMonthlyUnlimited !== undefined) {
      updateData.inboxLimitMonthlyUnlimited = data.inboxLimitMonthlyUnlimited;
    }
    if (data.inboxLimitMonthly !== undefined || data.inboxLimitMonthlyUnlimited !== undefined) {
      updateData.inboxLimitMonthly = data.inboxLimitMonthlyUnlimited
        ? null
        : Math.max(
            0,
            Number(data.inboxLimitMonthly ?? DEFAULT_LIMITS.inboxLimitMonthly)
          );
    }

    if (data.autoreplyLimitUnlimited !== undefined) {
      updateData.autoreplyLimitUnlimited = data.autoreplyLimitUnlimited;
    }
    if (data.autoreplyLimit !== undefined || data.autoreplyLimitUnlimited !== undefined) {
      updateData.autoreplyLimit = data.autoreplyLimitUnlimited
        ? null
        : Math.max(
            0,
            Number(data.autoreplyLimit ?? DEFAULT_LIMITS.autoreplyLimit)
          );
    }

    return this._planRepository.updatePlan(id, updateData);
  }

  async deletePlan(id: string) {
    const usage = await this._planRepository.getPlanUsage(id);
    if (!usage) {
      throw new Error('Plan not found');
    }
    if (usage.isDefault) {
      throw new Error('Default plan cannot be deleted');
    }
    if (usage._count.subscriptions > 0 || usage._count.payments > 0) {
      throw new Error('Plan is in use and cannot be deleted');
    }

    return this._planRepository.deletePlan(id);
  }
}
