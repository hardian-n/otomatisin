import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { GlobalSettingsService } from '@gitroom/nestjs-libraries/database/prisma/settings/global-settings.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

@ApiTags('Admin')
@Controller('/admin/settings')
export class AdminSettingsController {
  constructor(
    private _globalSettings: GlobalSettingsService,
    private _organizationService: OrganizationService
  ) {}

  @Get('/trial')
  async getGlobalTrial(@GetUserFromRequest() user: User) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    await this._globalSettings.ensureLoaded();
    return { enabled: this._globalSettings.getGlobalTrialEnabled() };
  }

  @Post('/trial')
  async updateGlobalTrial(
    @GetUserFromRequest() user: User,
    @Body('enabled') enabled?: boolean
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpForbiddenException();
    }

    if (typeof enabled !== 'boolean') {
      throw new Error('enabled must be a boolean');
    }

    await this._globalSettings.setGlobalTrialEnabled(enabled);
    if (!enabled) {
      await this._organizationService.disableAllTrials();
    }

    return { enabled };
  }
}
