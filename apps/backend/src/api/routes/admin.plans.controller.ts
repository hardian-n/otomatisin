import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
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

  @Post('/:tier')
  async updatePlan(
    @GetUserFromRequest() user: User,
    @Param('tier') tier: string,
    @Body()
    body: {
      visible?: boolean;
      monthPrice?: number | string | null;
      yearPrice?: number | string | null;
      channelLimit?: number | string | null;
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

    return this._plansService.updatePlan(tier, {
      visible: body.visible,
      monthPrice: normalizeNumber(body.monthPrice),
      yearPrice: normalizeNumber(body.yearPrice),
      channelLimit: normalizeNumber(body.channelLimit),
    });
  }

  @Delete('/:tier')
  async resetPlan(
    @GetUserFromRequest() user: User,
    @Param('tier') tier: string
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    return this._plansService.resetPlan(tier);
  }
}
