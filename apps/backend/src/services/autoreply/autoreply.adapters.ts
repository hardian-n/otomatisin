import axios from 'axios';

export type SendReplyInput = {
  channel: string;
  channelTargetId?: string | null;
  replyText: string;
  replyToMessageId?: string | null;
  metadata?: Record<string, any>;
};

export interface ChannelReplyAdapter {
  sendReply(input: SendReplyInput): Promise<void>;
}

class ThreadAdapter implements ChannelReplyAdapter {
  async sendReply(input: SendReplyInput): Promise<void> {
    const base = process.env.THREAD_API_BASE_URL;
    const token = process.env.THREAD_API_TOKEN;
    if (!base || !token) {
      throw new Error('THREAD_API_BASE_URL or THREAD_API_TOKEN is missing');
    }

    await axios.post(
      `${base.replace(/\/$/, '')}/internal/thread/reply`,
      {
        channel_target_id: input.channelTargetId,
        reply_text: input.replyText,
        reply_to_message_id: input.replyToMessageId,
        metadata: input.metadata || {},
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 15_000,
      }
    );
  }
}

class TelegramAdapter implements ChannelReplyAdapter {
  async sendReply(input: SendReplyInput): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is missing');
    }
    if (!input.channelTargetId) {
      throw new Error('channelTargetId (chat_id) is required for Telegram');
    }

    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: input.channelTargetId,
        text: input.replyText,
        reply_to_message_id: input.replyToMessageId || undefined,
        parse_mode: 'HTML',
      },
      { timeout: 15_000 }
    );
  }
}

export const getChannelAdapter = (channel: string): ChannelReplyAdapter => {
  switch (channel) {
    case 'threads':
    case 'thread':
      return new ThreadAdapter();
    case 'telegram':
      return new TelegramAdapter();
    default:
      throw new Error(`No adapter registered for channel ${channel}`);
  }
};
