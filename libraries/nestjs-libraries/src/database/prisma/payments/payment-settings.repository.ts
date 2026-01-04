import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PaymentProvider, DuitkuMode } from '@prisma/client';

type PaymentSettingsInput = {
  mode?: DuitkuMode;
  merchantCode?: string | null;
  apiKey?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  uniqueCodeEnabled?: boolean;
  uniqueCodeMin?: number | null;
  uniqueCodeMax?: number | null;
};

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
    data: PaymentSettingsInput
  ) {
    return this._paymentSetting.model.paymentSetting.upsert({
      where: { provider },
      update: {
        ...(data.mode ? { mode: data.mode } : {}),
        ...(data.merchantCode !== undefined
          ? { merchantCode: data.merchantCode }
          : {}),
        ...(data.apiKey !== undefined ? { apiKey: data.apiKey } : {}),
        ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
        ...(data.bankAccountNumber !== undefined
          ? { bankAccountNumber: data.bankAccountNumber }
          : {}),
        ...(data.bankAccountName !== undefined
          ? { bankAccountName: data.bankAccountName }
          : {}),
        ...(data.uniqueCodeEnabled !== undefined
          ? { uniqueCodeEnabled: data.uniqueCodeEnabled }
          : {}),
        ...(data.uniqueCodeMin !== undefined
          ? { uniqueCodeMin: data.uniqueCodeMin }
          : {}),
        ...(data.uniqueCodeMax !== undefined
          ? { uniqueCodeMax: data.uniqueCodeMax }
          : {}),
      },
      create: {
        provider,
        mode: data.mode || DuitkuMode.SANDBOX,
        merchantCode: data.merchantCode || null,
        apiKey: data.apiKey || null,
        bankName: data.bankName || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankAccountName: data.bankAccountName || null,
        uniqueCodeEnabled: data.uniqueCodeEnabled ?? true,
        uniqueCodeMin: data.uniqueCodeMin ?? 1,
        uniqueCodeMax: data.uniqueCodeMax ?? 999,
      },
    });
  }
}
