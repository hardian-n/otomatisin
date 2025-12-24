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
import { AuthService } from '@gitroom/helpers/auth/auth.service';

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

  private async alreadyHandledMessage(
    ruleId: string,
    messageId?: string | null,
    channelTargetId?: string | null
  ): Promise<boolean> {
    if (!messageId) {
      return false;
    }

    const existing = await this.prisma.autoreplyLog.findFirst({
      where: {
        ruleId,
        messageId,
        ...(channelTargetId ? { channelTargetId } : {}),
      },
      select: { id: true },
    });

    return !!existing;
  }

  private async sendThreadsReply(input: {
    integrationId?: string | null;
    replyToMessageId?: string | null;
    replyText: string;
  }) {
    if (!input.integrationId) {
      throw new Error('Threads reply requires integrationId');
    }
    if (!input.replyToMessageId) {
      throw new Error('Threads reply requires replyToMessageId');
    }

    const integration = await this.prisma.integration.findFirst({
      where: {
        id: input.integrationId,
        providerIdentifier: 'threads',
        deletedAt: null,
      },
      select: {
        internalId: true,
        token: true,
      },
    });

    if (!integration?.internalId || !integration?.token) {
      throw new Error('Threads integration is missing token or internalId');
    }

    const form = new FormData();
    form.append('media_type', 'TEXT');
    form.append('text', input.replyText);
    form.append('reply_to_id', input.replyToMessageId);
    form.append('access_token', integration.token);

    const createRes = await fetch(
      `https://graph.threads.net/v1.0/${integration.internalId}/threads`,
      {
        method: 'POST',
        body: form,
      }
    );

    if (!createRes.ok) {
      const errorText = await createRes.text();
      throw new Error(
        `Threads reply create failed: ${createRes.status} ${errorText}`
      );
    }

    const created = await createRes.json();
    const creationId = created?.id;
    if (!creationId) {
      throw new Error('Threads reply create failed: missing id');
    }

    await this.waitThreadsContainerReady(creationId, integration.token);

    const publishRes = await fetch(
      `https://graph.threads.net/v1.0/${integration.internalId}/threads_publish?creation_id=${creationId}&access_token=${integration.token}`,
      {
        method: 'POST',
      }
    );

    if (!publishRes.ok) {
      const errorText = await publishRes.text();
      throw new Error(
        `Threads reply publish failed: ${publishRes.status} ${errorText}`
      );
    }
  }

  private async waitThreadsContainerReady(
    creationId: string,
    accessToken: string
  ) {
    const maxAttempts = 6;
    const delayMs = 1500;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const res = await fetch(
        `https://graph.threads.net/v1.0/${creationId}?fields=status,error_message&access_token=${accessToken}`
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Threads reply status failed: ${res.status} ${errorText}`
        );
      }

      const payload = await res.json();
      const status = payload?.status;
      if (status === 'FINISHED') {
        return;
      }
      if (status === 'ERROR') {
        const message =
          typeof payload?.error_message === 'string'
            ? payload.error_message
            : 'unknown error';
        throw new Error(`Threads reply status error: ${message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error('Threads reply status timeout');
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
      const alreadyHandled = await this.alreadyHandledMessage(
        rule.id,
        input.messageId,
        input.channelTargetId
      );
      if (alreadyHandled) {
        continue;
      }

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
          const channel = input.channel?.toLowerCase();
          if (channel === 'threads' || channel === 'thread') {
            await this.sendThreadsReply({
              integrationId: input.integrationId ?? rule.integrationId ?? null,
              replyToMessageId: input.messageId,
              replyText: rule.replyText,
            });
            return;
          }
          if (channel === 'telegram') {
            const botToken = await this.resolveTelegramBotToken(
              input.orgId,
              input.integrationId ?? rule.integrationId ?? null,
              input.channelTargetId
            );
            const adapter = getChannelAdapter('telegram');
            await adapter.sendReply({
              channel: input.channel,
              channelTargetId: input.channelTargetId,
              replyText: rule.replyText,
              replyToMessageId: input.messageId,
              metadata: { ruleId: rule.id, botToken },
            });
            return;
          }

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

  private async resolveTelegramBotToken(
    orgId: string,
    integrationId?: string | null,
    channelTargetId?: string | null
  ) {
    let integration = null;
    if (integrationId) {
      integration = await this.prisma.integration.findFirst({
        where: {
          id: integrationId,
          organizationId: orgId,
          providerIdentifier: 'telegram',
          deletedAt: null,
        },
      });
    }

    if (!integration && channelTargetId) {
      integration = await this.prisma.integration.findFirst({
        where: {
          organizationId: orgId,
          providerIdentifier: 'telegram',
          token: channelTargetId,
          deletedAt: null,
        },
      });
    }

    const settings = this.parseTelegramSettings(
      integration?.customInstanceDetails
    );
    return (
      settings.botToken ||
      settings.telegramBotToken ||
      process.env.TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_TOKEN ||
      null
    );
  }

  private parseTelegramSettings(details?: string | null) {
    if (!details) {
      return {};
    }
    try {
      const decrypted = AuthService.fixedDecryption(details);
      const parsed = JSON.parse(decrypted);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, any>;
      }
    } catch {
      // ignore invalid custom instance details
    }
    return {};
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
