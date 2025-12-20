import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { AutoreplyRule } from '@prisma/client';
import {
  AutoreplyRuleLite,
  matchRuleText,
  normalizeText,
  orderByTargetAndPriority,
} from './autoreply.engine';
import { getChannelAdapter } from './autoreply.adapters';

type EvaluateInput = {
  orgId: string;
  channel: string;
  channelTargetId?: string | null;
  integrationId?: string | null;
  text: string;
  authorId?: string | null;
  messageId?: string | null;
  multiReply?: boolean;
};

type EvaluateTestInput = EvaluateInput;

@Injectable()
export class AutoreplyService {
  private readonly logger = new Logger(AutoreplyService.name);
  constructor(private readonly prisma: PrismaService) {}

  async listRules(orgId: string, channel?: string) {
    return this.prisma.autoreplyRule.findMany({
      where: {
        organizationId: orgId,
        ...(channel ? { channel } : {}),
      },
      orderBy: [
        {
          priority: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  async createRule(orgId: string, payload: Partial<AutoreplyRule>) {
    return this.prisma.autoreplyRule.create({
      data: {
        organizationId: orgId,
        channel: payload.channel!,
        integrationId: payload.integrationId ?? null,
        channelTargetId: payload.channelTargetId ?? null,
        name: payload.name ?? null,
        keywordPattern: payload.keywordPattern!,
        matchType: payload.matchType!,
        replyText: payload.replyText!,
        priority: payload.priority ?? 100,
        delaySec: payload.delaySec ?? 0,
        cooldownSec: payload.cooldownSec ?? 0,
        isActive: payload.isActive ?? true,
      },
    });
  }

  async updateRule(id: string, orgId: string, payload: Partial<AutoreplyRule>) {
    const updated = await this.prisma.autoreplyRule.updateMany({
      where: { id, organizationId: orgId },
      data: {
        ...payload,
        organizationId: orgId,
      },
    });
    if (!updated.count) {
      throw new Error('Rule not found');
    }
    return this.prisma.autoreplyRule.findUnique({ where: { id } });
  }

  async deleteRule(id: string, orgId: string) {
    const deleted = await this.prisma.autoreplyRule.deleteMany({
      where: { id, organizationId: orgId },
    });
    return { deleted: deleted.count > 0 };
  }

  private filterMatches(
    rules: AutoreplyRule[],
    text: string,
    channelTargetId?: string | null
  ) {
    const normalizedText = normalizeText(text);
    const ordered = orderByTargetAndPriority(
      rules as unknown as AutoreplyRuleLite[],
      channelTargetId
    );

    const targetedMatches = ordered
      .filter((rule) => !!rule.channelTargetId)
      .filter((rule) =>
        matchRuleText(
          { keywordPattern: rule.keywordPattern, matchType: rule.matchType },
          normalizedText
        )
      );

    if (targetedMatches.length) {
      return targetedMatches as AutoreplyRule[];
    }

    const globalMatches = ordered
      .filter((rule) => !rule.channelTargetId)
      .filter((rule) =>
        matchRuleText(
          { keywordPattern: rule.keywordPattern, matchType: rule.matchType },
          normalizedText
        )
      );

    return globalMatches as AutoreplyRule[];
  }

  private async passesCooldown(
    rule: AutoreplyRule,
    authorId?: string | null
  ): Promise<boolean> {
    if (!rule.cooldownSec || rule.cooldownSec <= 0 || !authorId) {
      return true;
    }

    const since = new Date(Date.now() - rule.cooldownSec * 1000);
    const recent = await this.prisma.autoreplyLog.findFirst({
      where: {
        ruleId: rule.id,
        authorId,
        triggeredAt: {
          gte: since,
        },
      },
      orderBy: {
        triggeredAt: 'desc',
      },
    });

    return !recent;
  }

  async matchRules(input: EvaluateInput) {
    const candidates = await this.prisma.autoreplyRule.findMany({
      where: {
        organizationId: input.orgId,
        channel: input.channel,
        isActive: true,
      },
      orderBy: [
        {
          priority: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    const matched = this.filterMatches(
      candidates,
      input.text,
      input.channelTargetId
    );

    const result: AutoreplyRule[] = [];
    for (const rule of matched) {
      const allowed = await this.passesCooldown(rule, input.authorId);
      if (!allowed) {
        continue;
      }
      result.push(rule);
      if (!input.multiReply) {
        break;
      }
    }

    return result;
  }

  async evaluate(input: EvaluateInput) {
    const matchedRules = await this.matchRules(input);

    if (!matchedRules.length) {
      return { matched: false, replies: [] as any[] };
    }

    const replies = [];

    for (const rule of matchedRules) {
      // Create log first (optimistic)
      const log = await this.prisma.autoreplyLog.create({
        data: {
          ruleId: rule.id,
          organizationId: input.orgId,
          channel: input.channel,
          integrationId: rule.integrationId ?? null,
          channelTargetId: input.channelTargetId ?? null,
          messageId: input.messageId ?? null,
          authorId: input.authorId ?? null,
          matchedText: input.text,
          matchType: rule.matchType,
          replyText: rule.replyText,
          cooldownApplied: false,
          meta: {
            multiReply: input.multiReply ?? false,
            delaySec: rule.delaySec,
          },
        },
      });

      const send = async () => {
        try {
          const adapter = getChannelAdapter(input.channel);
          await adapter.sendReply({
            channel: input.channel,
            channelTargetId: input.channelTargetId,
            replyText: rule.replyText,
            replyToMessageId: input.messageId,
            metadata: { ruleId: rule.id },
          });
        } catch (err: any) {
          const message =
            typeof err?.message === 'string' ? err.message : 'send failed';
          this.logger.warn(`Autoreply send failed: ${message}`);
          await this.prisma.autoreplyLog.update({
            where: { id: log.id },
            data: { error: message },
          });
        }
      };

      try {
        if (rule.delaySec && rule.delaySec > 0) {
          // Simple in-memory delay placeholder; production should enqueue a job.
          setTimeout(send, rule.delaySec * 1000);
        } else {
          await send();
        }
      } catch (err) {
        this.logger.warn(`Failed to process autoreply for rule ${rule.id}: ${err}`);
      }

      replies.push({
        ruleId: rule.id,
        replyText: rule.replyText,
        scheduledInSec: rule.delaySec,
      });

      if (!input.multiReply) {
        break;
      }
    }

    return {
      matched: true,
      replies,
    };
  }

  private buildOptionalFilter(
    field: 'integrationId' | 'channelTargetId',
    value?: string | null
  ) {
    if (value) {
      return { OR: [{ [field]: value }, { [field]: null }] };
    }
    return { [field]: null };
  }

  async matchRulesForTest(input: EvaluateTestInput) {
    const candidates = await this.prisma.autoreplyRule.findMany({
      where: {
        organizationId: input.orgId,
        channel: input.channel,
        isActive: true,
        AND: [
          this.buildOptionalFilter('integrationId', input.integrationId),
          this.buildOptionalFilter('channelTargetId', input.channelTargetId),
        ],
      },
      orderBy: [
        {
          priority: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    const matched = candidates.filter((rule) =>
      matchRuleText(
        { keywordPattern: rule.keywordPattern, matchType: rule.matchType },
        input.text
      )
    );

    const result: AutoreplyRule[] = [];
    for (const rule of matched) {
      const allowed = await this.passesCooldown(rule, input.authorId);
      if (!allowed) {
        continue;
      }
      result.push(rule);
      if (!input.multiReply) {
        break;
      }
    }

    return result;
  }

  async evaluateTest(input: EvaluateTestInput) {
    const matchedRules = await this.matchRulesForTest(input);

    if (!matchedRules.length) {
      return { matched: false, replies: [] as any[] };
    }

    const replies = [];

    for (const rule of matchedRules) {
      await this.prisma.autoreplyLog.create({
        data: {
          ruleId: rule.id,
          organizationId: input.orgId,
          channel: input.channel,
          integrationId: input.integrationId ?? rule.integrationId ?? null,
          channelTargetId: input.channelTargetId ?? null,
          messageId: input.messageId ?? null,
          authorId: input.authorId ?? null,
          matchedText: input.text,
          matchType: rule.matchType,
          replyText: rule.replyText,
          cooldownApplied: false,
          meta: {
            multiReply: input.multiReply ?? false,
            delaySec: rule.delaySec,
            source: 'test',
          },
        },
      });

      replies.push({
        ruleId: rule.id,
        replyText: rule.replyText,
        scheduledInSec: rule.delaySec,
      });

      if (!input.multiReply) {
        break;
      }
    }

    return {
      matched: true,
      replies,
    };
  }
}
