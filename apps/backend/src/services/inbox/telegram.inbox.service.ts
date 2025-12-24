import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { AutoreplyService } from '@gitroom/backend/services/autoreply/autoreply.service';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessagePayload;
  channel_post?: TelegramMessagePayload;
};

type TelegramMessagePayload = {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  chat?: {
    id: number;
    title?: string;
    username?: string;
  };
  from?: {
    id: number;
    username?: string;
    is_bot?: boolean;
  };
};

type TelegramInboxMessage = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
};

@Injectable()
export class TelegramInboxService {
  constructor(
    private readonly _integrationRepository: IntegrationRepository,
    private readonly _autoreplyService: AutoreplyService
  ) {}

  listChannels(orgId: string) {
    return this._integrationRepository.getIntegrationsByProvider(orgId, 'telegram');
  }

  async getMessages(
    orgId: string,
    integrationId: string,
    limit = 20
  ) {
    const integration = await this._integrationRepository.getIntegrationById(
      orgId,
      integrationId
    );
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    if (integration.providerIdentifier !== 'telegram') {
      throw new BadRequestException('Integration is not Telegram');
    }

    const token = process.env.TELEGRAM_TOKEN;
    if (!token) {
      throw new BadRequestException('TELEGRAM_TOKEN is not configured');
    }

    const chatId = Number(integration.token);
    if (!Number.isFinite(chatId)) {
      throw new BadRequestException('Telegram integration chat id is invalid');
    }

    const updates = await this.fetchUpdates(token, limit);
    const lastKey = `inbox:telegram:last_update:${integration.id}`;
    const lastSeen = Number(await ioRedis.get(lastKey)) || 0;

    const filtered = updates
      .filter((u) => u.update_id > lastSeen)
      .filter((u) => this.isChatMatch(u, chatId))
      .sort((a, b) => a.update_id - b.update_id);

    if (filtered.length) {
      const maxUpdateId = filtered[filtered.length - 1].update_id;
      await ioRedis.set(lastKey, String(maxUpdateId));
    }

    const messages = filtered
      .map((update) => this.mapMessage(update))
      .filter(Boolean) as TelegramInboxMessage[];

    await this.processAutoreplies(orgId, integration.id, String(chatId), filtered);

    return {
      integration: {
        id: integration.id,
        name: integration.name,
        profile: integration.profile,
        picture: integration.picture,
        providerIdentifier: integration.providerIdentifier,
      },
      messages,
      lastSync: new Date().toISOString(),
    };
  }

  private async fetchUpdates(token: string, limit: number): Promise<TelegramUpdate[]> {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const params = new URLSearchParams({
      limit: String(safeLimit),
      allowed_updates: 'message,channel_post',
    });
    const url = `https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Telegram getUpdates failed: ${res.status} ${errorText}`);
    }
    const payload = await res.json();
    if (!payload?.ok || !Array.isArray(payload?.result)) {
      return [];
    }
    return payload.result as TelegramUpdate[];
  }

  private isChatMatch(update: TelegramUpdate, chatId: number) {
    const message = update.message || update.channel_post;
    return message?.chat?.id === chatId;
  }

  private mapMessage(update: TelegramUpdate): TelegramInboxMessage | null {
    const message = update.message || update.channel_post;
    if (!message) {
      return null;
    }

    return {
      id: String(message.message_id),
      text: message.text || message.caption || '',
      username: message.from?.username || undefined,
      timestamp: message.date
        ? new Date(message.date * 1000).toISOString()
        : undefined,
    };
  }

  private async processAutoreplies(
    orgId: string,
    integrationId: string,
    chatId: string,
    updates: TelegramUpdate[]
  ) {
    for (const update of updates) {
      const message = update.message || update.channel_post;
      if (!message) {
        continue;
      }
      if (message.from?.is_bot) {
        continue;
      }
      const text = message.text || message.caption;
      if (!text) {
        continue;
      }

      try {
        await this._autoreplyService.evaluate({
          orgId,
          channel: 'telegram',
          integrationId,
          channelTargetId: chatId,
          text,
          authorId: message.from?.username
            ? String(message.from.username)
            : message.from?.id
            ? String(message.from.id)
            : null,
          messageId: String(message.message_id),
          multiReply: false,
        });
      } catch {
        // Ignore autoreply failures to keep polling resilient.
      }
    }
  }
}

