import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class PlanOverrideRepository {
  constructor(
    private readonly _planOverride: PrismaRepository<'planOverride'>
  ) {}

  listOverrides() {
    return this._planOverride.model.planOverride.findMany();
  }

  upsertOverride(
    tier: string,
    data: {
      visible?: boolean;
      monthPrice?: number | null;
      yearPrice?: number | null;
      channelLimit?: number | null;
    }
  ) {
    return this._planOverride.model.planOverride.upsert({
      where: { tier },
      update: {
        visible: data.visible ?? undefined,
        monthPrice:
          data.monthPrice === undefined ? undefined : data.monthPrice,
        yearPrice: data.yearPrice === undefined ? undefined : data.yearPrice,
        channelLimit:
          data.channelLimit === undefined ? undefined : data.channelLimit,
      },
      create: {
        tier,
        visible: data.visible ?? true,
        monthPrice: data.monthPrice ?? null,
        yearPrice: data.yearPrice ?? null,
        channelLimit: data.channelLimit ?? null,
      },
    });
  }

  deleteOverride(tier: string) {
    return this._planOverride.model.planOverride.deleteMany({
      where: { tier },
    });
  }
}
