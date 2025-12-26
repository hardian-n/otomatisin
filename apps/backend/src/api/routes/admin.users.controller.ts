import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';

@ApiTags('Admin')
@Controller('/admin/users')
export class AdminUsersController {
  constructor(private _usersService: UsersService) {}

  @Get()
  async listUsers(
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
    const users = await this._usersService.listAdminOwners(
      q,
      resolvedSkip,
      resolvedTake
    );

    return users.map((owner) => {
      const ownerOrganizations = owner.organizations.map((org) => org.organization);
      return {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        providerName: owner.providerName,
        activated: owner.activated,
        isSuperAdmin: owner.isSuperAdmin,
        createdAt: owner.createdAt,
        lastOnline: owner.lastOnline,
        ownerOrganizations,
        ownerOrgCount: ownerOrganizations.length,
      };
    });
  }
}
