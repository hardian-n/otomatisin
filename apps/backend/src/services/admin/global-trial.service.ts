import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { GlobalSettingsService } from '@gitroom/nestjs-libraries/database/prisma/settings/global-settings.service';

@Injectable()
export class GlobalTrialService implements OnModuleInit {
  constructor(
    private _organizationService: OrganizationService,
    private _globalSettings: GlobalSettingsService
  ) {}

  async onModuleInit() {
    await this._globalSettings.ensureLoaded();
    if (!this._globalSettings.getGlobalTrialEnabled()) {
      await this._organizationService.disableAllTrials();
    }
  }
}
