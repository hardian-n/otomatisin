import { Injectable, OnModuleInit } from '@nestjs/common';
import { GlobalSettingRepository } from '@gitroom/nestjs-libraries/database/prisma/settings/global-setting.repository';

const GLOBAL_TRIAL_KEY = 'global_trial_enabled';

const parseBoolean = (raw?: string | null, fallback = true) => {
  if (raw === undefined || raw === null) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  const value = trimmed.toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(value);
};

@Injectable()
export class GlobalSettingsService implements OnModuleInit {
  private _globalTrialEnabled: boolean | undefined;

  constructor(private readonly _globalSettingRepo: GlobalSettingRepository) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  async ensureLoaded() {
    if (this._globalTrialEnabled === undefined) {
      await this.loadFromStore();
    }
  }

  getGlobalTrialEnabled() {
    if (this._globalTrialEnabled === undefined) {
      return parseBoolean(process.env.GLOBAL_TRIAL_ENABLED, true);
    }
    return this._globalTrialEnabled;
  }

  async setGlobalTrialEnabled(enabled: boolean) {
    this._globalTrialEnabled = enabled;
    await this._globalSettingRepo.upsertValue(
      GLOBAL_TRIAL_KEY,
      enabled ? 'true' : 'false'
    );
    return this._globalTrialEnabled;
  }

  private async loadFromStore() {
    const record = await this._globalSettingRepo.getByKey(GLOBAL_TRIAL_KEY);
    if (record?.value !== undefined) {
      this._globalTrialEnabled = parseBoolean(record.value, true);
      return;
    }

    const envEnabled = parseBoolean(process.env.GLOBAL_TRIAL_ENABLED, true);
    this._globalTrialEnabled = envEnabled;
    await this._globalSettingRepo.upsertValue(
      GLOBAL_TRIAL_KEY,
      envEnabled ? 'true' : 'false'
    );
  }
}
