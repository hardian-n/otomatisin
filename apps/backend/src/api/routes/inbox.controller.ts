import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ThreadsInboxService } from '@gitroom/backend/services/inbox/threads.inbox.service';
import { TelegramInboxService } from '@gitroom/backend/services/inbox/telegram.inbox.service';

@ApiTags('Inbox')
@Controller('/inbox')
export class InboxController {
  constructor(
    private _threadsInboxService: ThreadsInboxService,
    private _telegramInboxService: TelegramInboxService
  ) {}

  @Get('/threads/channels')
  async listThreadsChannels(@GetOrgFromRequest() org: Organization) {
    const channels = await this._threadsInboxService.listChannels(org.id);
    return { channels };
  }

  @Get('/threads/replies')
  async listThreadsReplies(
    @GetOrgFromRequest() org: Organization,
    @Query('integrationId') integrationId: string,
    @Query('postLimit') postLimit?: string,
    @Query('replyLimit') replyLimit?: string
  ) {
    if (!integrationId) {
      throw new BadRequestException('integrationId is required');
    }
    const posts = await this._threadsInboxService.getReplies(
      org.id,
      integrationId,
      postLimit ? Number(postLimit) : undefined,
      replyLimit ? Number(replyLimit) : undefined
    );
    return posts;
  }

  @Get('/telegram/channels')
  async listTelegramChannels(@GetOrgFromRequest() org: Organization) {
    const channels = await this._telegramInboxService.listChannels(org.id);
    return { channels };
  }

  @Get('/telegram/messages')
  async listTelegramMessages(
    @GetOrgFromRequest() org: Organization,
    @Query('integrationId') integrationId: string,
    @Query('limit') limit?: string
  ) {
    if (!integrationId) {
      throw new BadRequestException('integrationId is required');
    }
    return this._telegramInboxService.getMessages(
      org.id,
      integrationId,
      limit ? Number(limit) : undefined
    );
  }
}
