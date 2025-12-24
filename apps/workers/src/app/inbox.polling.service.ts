import { Injectable, Logger } from '@nestjs/common';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { ThreadsInboxService } from '@gitroom/backend/services/inbox/threads.inbox.service';
import { TelegramInboxService } from '@gitroom/backend/services/inbox/telegram.inbox.service';

type InboxPollPayload = {
  providers?: string[];
  postLimit?: number;
  replyLimit?: number;
};

@Injectable()
export class InboxPollingService {
  private readonly logger = new Logger(InboxPollingService.name);

  constructor(
    private readonly _integrationRepository: IntegrationRepository,
    private readonly _threadsInboxService: ThreadsInboxService,
    private readonly _telegramInboxService: TelegramInboxService
  ) {}

  async poll(payload?: InboxPollPayload) {
    const providers = (payload?.providers?.length
      ? payload.providers
      : ['threads', 'telegram']
    )
      .map((p) => p.toLowerCase().trim())
      .filter(Boolean);

    const postLimit = this.clampNumber(
      payload?.postLimit ?? this.parseNumber(process.env.INBOX_POLL_POST_LIMIT),
      1,
      25,
      10
    );
    const replyLimit = this.clampNumber(
      payload?.replyLimit ??
        this.parseNumber(process.env.INBOX_POLL_REPLY_LIMIT),
      1,
      50,
      20
    );
    const delayMs = this.clampNumber(
      this.parseNumber(process.env.INBOX_POLL_DELAY_MS),
      0,
      5000,
      250
    );

    for (const provider of providers) {
      switch (provider) {
        case 'threads':
          await this.pollThreads(postLimit, replyLimit, delayMs);
          break;
        case 'telegram':
          await this.pollTelegram(replyLimit, delayMs);
          break;
        default:
          this.logger.debug(`Inbox polling not implemented for ${provider}`);
          break;
      }
    }
  }

  private async pollThreads(
    postLimit: number,
    replyLimit: number,
    delayMs: number
  ) {
    const integrations =
      await this._integrationRepository.getAllIntegrationsByProvider('threads');

    for (const integration of integrations) {
      if (
        integration.disabled ||
        integration.inBetweenSteps ||
        integration.refreshNeeded
      ) {
        continue;
      }

      try {
        await this._threadsInboxService.getReplies(
          integration.organizationId,
          integration.id,
          postLimit,
          replyLimit
        );
      } catch (err: any) {
        const message =
          typeof err?.message === 'string' ? err.message : 'poll failed';
        this.logger.warn(
          `Threads inbox poll failed for ${integration.id}: ${message}`
        );
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private async pollTelegram(replyLimit: number, delayMs: number) {
    const integrations =
      await this._integrationRepository.getAllIntegrationsByProvider('telegram');

    for (const integration of integrations) {
      if (
        integration.disabled ||
        integration.inBetweenSteps ||
        integration.refreshNeeded
      ) {
        continue;
      }

      try {
        await this._telegramInboxService.getMessages(
          integration.organizationId,
          integration.id,
          replyLimit
        );
      } catch (err: any) {
        const message =
          typeof err?.message === 'string' ? err.message : 'poll failed';
        this.logger.warn(
          `Telegram inbox poll failed for ${integration.id}: ${message}`
        );
      }

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private parseNumber(value: string | undefined) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return parsed;
  }

  private clampNumber(
    value: number | undefined,
    min: number,
    max: number,
    fallback: number
  ) {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, value as number));
  }
}
