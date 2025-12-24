import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BullMqClient } from '@gitroom/nestjs-libraries/bull-mq-transport-new/client';
import {
  InboxPollPayload,
  InboxPollingService,
} from '@gitroom/backend/services/inbox/inbox.polling.service';

@Injectable()
export class InboxPollSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(InboxPollSchedulerService.name);
  private isRunning = false;
  private intervalHandle?: NodeJS.Timeout;

  constructor(
    private readonly _workerServiceProducer: BullMqClient,
    private readonly _pollingService: InboxPollingService
  ) {}

  onModuleInit() {
    const enabled = (process.env.INBOX_POLL_ENABLED || 'true').toLowerCase();
    if (enabled === 'false' || enabled === '0') {
      this.logger.log('Inbox polling disabled via INBOX_POLL_ENABLED');
      this._workerServiceProducer
        .deleteScheduler('inbox-poll', 'inbox-poll')
        .catch(() => null);
      return;
    }

    const intervalSec = this.parseNumber(
      process.env.INBOX_POLL_INTERVAL_SEC,
      30
    );
    const mode = (process.env.INBOX_POLL_MODE || 'inline').toLowerCase();
    const providers = (process.env.INBOX_POLL_PROVIDERS || 'threads,telegram')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    const payload: InboxPollPayload = {
      providers,
      postLimit: this.parseNumber(process.env.INBOX_POLL_POST_LIMIT, 10),
      replyLimit: this.parseNumber(process.env.INBOX_POLL_REPLY_LIMIT, 20),
    };

    if (mode === 'queue') {
      this._workerServiceProducer.emit('inbox-poll', {
        id: 'inbox-poll',
        options: {
          every: intervalSec * 1000,
          immediately: true,
        },
        payload,
      });

      this.logger.log(
        `Inbox polling scheduled (queue) every ${intervalSec}s for providers: ${providers.join(
          ', '
        )}`
      );
      return;
    }

    this.startInlinePolling(intervalSec, payload);
  }

  private startInlinePolling(intervalSec: number, payload: InboxPollPayload) {
    const run = async () => {
      if (this.isRunning) {
        return;
      }
      this.isRunning = true;
      try {
        await this._pollingService.poll(payload);
      } finally {
        this.isRunning = false;
      }
    };

    run().catch(() => null);
    this.intervalHandle = setInterval(run, intervalSec * 1000);

    this.logger.log(
      `Inbox polling scheduled (inline) every ${intervalSec}s for providers: ${(
        payload.providers || []
      ).join(', ')}`
    );
  }

  private parseNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
