import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class PlanRepository {
  constructor(private readonly _plan: PrismaRepository<'plan'>) {}

  listPlans(includeInactive = true) {
    return this._plan.model.plan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  getPlanById(id: string) {
    return this._plan.model.plan.findUnique({
      where: { id },
    });
  }

  getPlanByKey(key: string) {
    return this._plan.model.plan.findUnique({
      where: { key },
    });
  }

  createPlan(data: {
    key: string;
    name: string;
    description?: string | null;
    price: number;
    currency: string;
    durationDays: number;
    trialEnabled: boolean;
    trialDays: number;
    isActive: boolean;
    isDefault: boolean;
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
    return this._plan.model.plan.create({ data });
  }

  updatePlan(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      price: number;
      currency: string;
      durationDays: number;
      trialEnabled: boolean;
      trialDays: number;
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
    }>
  ) {
    return this._plan.model.plan.update({
      where: { id },
      data,
    });
  }

  getPlanUsage(id: string) {
    return this._plan.model.plan.findUnique({
      where: { id },
      select: {
        id: true,
        key: true,
        isDefault: true,
        _count: {
          select: {
            subscriptions: true,
            payments: true,
          },
        },
      },
    });
  }

  deletePlan(id: string) {
    return this._plan.model.plan.delete({
      where: { id },
    });
  }

  clearDefaultPlan() {
    return this._plan.model.plan.updateMany({
      data: { isDefault: false },
    });
  }
}
