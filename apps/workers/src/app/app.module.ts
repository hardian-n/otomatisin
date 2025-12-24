import { Module } from '@nestjs/common';

import { DatabaseModule } from '@gitroom/nestjs-libraries/database/prisma/database.module';
import { PostsController } from '@gitroom/workers/app/posts.controller';
import { BullMqModule } from '@gitroom/nestjs-libraries/bull-mq-transport-new/bull.mq.module';
import { PlugsController } from '@gitroom/workers/app/plugs.controller';
import { SentryModule } from '@sentry/nestjs/setup';
import { FILTER } from '@gitroom/nestjs-libraries/sentry/sentry.exception';
import { InboxController } from '@gitroom/workers/app/inbox.controller';
import { InboxPollingService } from '@gitroom/workers/app/inbox.polling.service';
import { ThreadsInboxService } from '@gitroom/backend/services/inbox/threads.inbox.service';
import { AutoreplyService } from '@gitroom/backend/services/autoreply/autoreply.service';
import { TelegramInboxService } from '@gitroom/backend/services/inbox/telegram.inbox.service';

@Module({
  imports: [SentryModule.forRoot(), DatabaseModule, BullMqModule],
  controllers: [PostsController, PlugsController, InboxController],
  providers: [
    FILTER,
    InboxPollingService,
    ThreadsInboxService,
    TelegramInboxService,
    AutoreplyService,
  ],
})
export class AppModule {}
