import { Injectable, OnModuleInit } from '@nestjs/common';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';

const isGlobalTrialEnabled = () => {
  const raw = process.env.GLOBAL_TRIAL_ENABLED;
  if (!raw) {
    return true;
  }
  const value = raw.trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(value);
};

@Injectable()
export class GlobalTrialService implements OnModuleInit {
  constructor(private _organizationService: OrganizationService) {}

  async onModuleInit() {
    if (!isGlobalTrialEnabled()) {
      await this._organizationService.disableAllTrials();
    }
  }
}
