import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { PlansService } from '@gitroom/nestjs-libraries/database/prisma/plans/plans.service';

@ApiTags('Admin')
@Controller('/admin/plans')
export class AdminPlansController {
  constructor(private readonly _plansService: PlansService) {}

  @Get()
  async listPlans(@GetUserFromRequest() user: User) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    return this._plansService.listPlans(true);
  }

  @Post()
  async createPlan(
    @GetUserFromRequest() user: User,
    @Body()
    body: {
      key: string;
      name: string;
      description?: string | null;
      price?: number | string | null;
      currency?: string | null;
      durationDays?: number | string | null;
      trialEnabled?: boolean;
      trialDays?: number | string | null;
      isActive?: boolean;
      isDefault?: boolean;
      channelLimit?: number | string | null;
      channelLimitUnlimited?: boolean;
      postLimitMonthly?: number | string | null;
      postLimitMonthlyUnlimited?: boolean;
      memberLimit?: number | string | null;
      memberLimitUnlimited?: boolean;
      storageLimitMb?: number | string | null;
      storageLimitMbUnlimited?: boolean;
      inboxLimitMonthly?: number | string | null;
      inboxLimitMonthlyUnlimited?: boolean;
      autoreplyLimit?: number | string | null;
      autoreplyLimitUnlimited?: boolean;
    }
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    const normalizeNumber = (value?: number | string | null) => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(parsed, 0) : null;
    };

    return this._plansService.createPlan({
      key: body.key,
      name: body.name,
      description: body.description ?? null,
      price: normalizeNumber(body.price),
      currency: body.currency ?? 'IDR',
      durationDays: normalizeNumber(body.durationDays),
      trialEnabled: body.trialEnabled,
      trialDays: normalizeNumber(body.trialDays),
      isActive: body.isActive,
      isDefault: body.isDefault,
      channelLimit: normalizeNumber(body.channelLimit),
      channelLimitUnlimited: body.channelLimitUnlimited,
      postLimitMonthly: normalizeNumber(body.postLimitMonthly),
      postLimitMonthlyUnlimited: body.postLimitMonthlyUnlimited,
      memberLimit: normalizeNumber(body.memberLimit),
      memberLimitUnlimited: body.memberLimitUnlimited,
      storageLimitMb: normalizeNumber(body.storageLimitMb),
      storageLimitMbUnlimited: body.storageLimitMbUnlimited,
      inboxLimitMonthly: normalizeNumber(body.inboxLimitMonthly),
      inboxLimitMonthlyUnlimited: body.inboxLimitMonthlyUnlimited,
      autoreplyLimit: normalizeNumber(body.autoreplyLimit),
      autoreplyLimitUnlimited: body.autoreplyLimitUnlimited,
    });
  }

  @Patch('/:id')
  async updatePlan(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string | null;
      price?: number | string | null;
      currency?: string | null;
      durationDays?: number | string | null;
      trialEnabled?: boolean;
      trialDays?: number | string | null;
      isActive?: boolean;
      isDefault?: boolean;
      channelLimit?: number | string | null;
      channelLimitUnlimited?: boolean;
      postLimitMonthly?: number | string | null;
      postLimitMonthlyUnlimited?: boolean;
      memberLimit?: number | string | null;
      memberLimitUnlimited?: boolean;
      storageLimitMb?: number | string | null;
      storageLimitMbUnlimited?: boolean;
      inboxLimitMonthly?: number | string | null;
      inboxLimitMonthlyUnlimited?: boolean;
      autoreplyLimit?: number | string | null;
      autoreplyLimitUnlimited?: boolean;
    }
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    const normalizeNumber = (value?: number | string | null) => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(parsed, 0) : null;
    };

    return this._plansService.updatePlan(id, {
      ...(body.name ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.price !== undefined ? { price: normalizeNumber(body.price) } : {}),
      ...(body.currency ? { currency: body.currency } : {}),
      ...(body.durationDays !== undefined
        ? { durationDays: normalizeNumber(body.durationDays) }
        : {}),
      ...(body.trialEnabled !== undefined ? { trialEnabled: body.trialEnabled } : {}),
      ...(body.trialDays !== undefined
        ? { trialDays: normalizeNumber(body.trialDays) }
        : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      ...(body.channelLimit !== undefined
        ? { channelLimit: normalizeNumber(body.channelLimit) }
        : {}),
      ...(body.channelLimitUnlimited !== undefined
        ? { channelLimitUnlimited: body.channelLimitUnlimited }
        : {}),
      ...(body.postLimitMonthly !== undefined
        ? { postLimitMonthly: normalizeNumber(body.postLimitMonthly) }
        : {}),
      ...(body.postLimitMonthlyUnlimited !== undefined
        ? { postLimitMonthlyUnlimited: body.postLimitMonthlyUnlimited }
        : {}),
      ...(body.memberLimit !== undefined
        ? { memberLimit: normalizeNumber(body.memberLimit) }
        : {}),
      ...(body.memberLimitUnlimited !== undefined
        ? { memberLimitUnlimited: body.memberLimitUnlimited }
        : {}),
      ...(body.storageLimitMb !== undefined
        ? { storageLimitMb: normalizeNumber(body.storageLimitMb) }
        : {}),
      ...(body.storageLimitMbUnlimited !== undefined
        ? { storageLimitMbUnlimited: body.storageLimitMbUnlimited }
        : {}),
      ...(body.inboxLimitMonthly !== undefined
        ? { inboxLimitMonthly: normalizeNumber(body.inboxLimitMonthly) }
        : {}),
      ...(body.inboxLimitMonthlyUnlimited !== undefined
        ? { inboxLimitMonthlyUnlimited: body.inboxLimitMonthlyUnlimited }
        : {}),
      ...(body.autoreplyLimit !== undefined
        ? { autoreplyLimit: normalizeNumber(body.autoreplyLimit) }
        : {}),
      ...(body.autoreplyLimitUnlimited !== undefined
        ? { autoreplyLimitUnlimited: body.autoreplyLimitUnlimited }
        : {}),
    });
  }

  @Delete('/:id')
  async deletePlan(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    try {
      return await this._plansService.deletePlan(id);
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Failed to delete plan');
    }
  }
}
