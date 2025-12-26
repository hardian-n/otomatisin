import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class GlobalSettingRepository {
  constructor(
    private readonly _globalSetting: PrismaRepository<'globalSetting'>
  ) {}

  getByKey(key: string) {
    return this._globalSetting.model.globalSetting.findUnique({
      where: { key },
    });
  }

  upsertValue(key: string, value: string) {
    return this._globalSetting.model.globalSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
