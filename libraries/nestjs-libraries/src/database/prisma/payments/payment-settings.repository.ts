import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PaymentProvider, DuitkuMode } from '@prisma/client';

@Injectable()
export class PaymentSettingsRepository {
  constructor(
    private readonly _paymentSetting: PrismaRepository<'paymentSetting'>
  ) {}

  getProviderSettings(provider: PaymentProvider) {
    return this._paymentSetting.model.paymentSetting.findUnique({
      where: { provider },
    });
  }

  upsertProviderSettings(
    provider: PaymentProvider,
    data: { mode?: DuitkuMode; merchantCode?: string | null; apiKey?: string | null }
  ) {
    return this._paymentSetting.model.paymentSetting.upsert({
      where: { provider },
      update: {
        ...(data.mode ? { mode: data.mode } : {}),
        ...(data.merchantCode !== undefined
          ? { merchantCode: data.merchantCode }
          : {}),
        ...(data.apiKey !== undefined ? { apiKey: data.apiKey } : {}),
      },
      create: {
        provider,
        mode: data.mode || DuitkuMode.SANDBOX,
        merchantCode: data.merchantCode || null,
        apiKey: data.apiKey || null,
      },
    });
  }
}
