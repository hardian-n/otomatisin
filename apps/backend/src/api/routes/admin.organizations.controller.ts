import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { AdminOrganizationSubscriptionDto } from '@gitroom/nestjs-libraries/dtos/admin/admin.organization.subscription.dto';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';

@ApiTags('Admin')
@Controller('/admin/organizations')
export class AdminOrganizationsController {
  constructor(
    private _organizationService: OrganizationService,
    private _subscriptionService: SubscriptionService
  ) {}

  @Get()
  async listOrganizations(
    @GetUserFromRequest() user: User,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    const resolvedSkip = Math.max(Number(skip) || 0, 0);
    const resolvedTake = Math.min(Math.max(Number(take) || 50, 1), 200);
    const organizations = await this._organizationService.listAdminOrganizations(
      q,
      resolvedSkip,
      resolvedTake
    );

    return organizations.map((org) => ({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      paymentId: org.paymentId,
      subscription: org.subscription
        ? {
            id: org.subscription.id,
            status: org.subscription.status,
            startsAt: org.subscription.startsAt,
            endsAt: org.subscription.endsAt,
            trialEndsAt: org.subscription.trialEndsAt,
            canceledAt: org.subscription.canceledAt,
            plan: org.subscription.plan || null,
          }
        : null,
      owner: org.users?.[0]?.user || null,
      usersCount: org._count?.users ?? 0,
    }));
  }

  @Post('/:id/subscription')
  async updateSubscription(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: AdminOrganizationSubscriptionDto
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    return this._subscriptionService.adminUpdateSubscription(id, body);
  }
}
