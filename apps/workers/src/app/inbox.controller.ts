import { Controller } from '@nestjs/common';
import { EventPattern, Transport } from '@nestjs/microservices';
import { InboxPollingService } from '@gitroom/workers/app/inbox.polling.service';

type InboxPollJob = {
  payload?: {
    providers?: string[];
    postLimit?: number;
    replyLimit?: number;
  };
  providers?: string[];
  postLimit?: number;
  replyLimit?: number;
};

@Controller()
export class InboxController {
  constructor(private readonly _pollingService: InboxPollingService) {}

  @EventPattern('inbox-poll', Transport.REDIS)
  async poll(data: InboxPollJob) {
    try {
      const payload = data?.payload || {
        providers: data?.providers,
        postLimit: data?.postLimit,
        replyLimit: data?.replyLimit,
      };
      await this._pollingService.poll(payload);
    } catch (err) {
      console.log(
        "Unhandled error, let's avoid crashing the inbox worker",
        err
      );
    }
  }
}

