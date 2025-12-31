import { Controller } from '@nestjs/common';
import { EventPattern, Transport } from '@nestjs/microservices';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { AutopostService } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.service';
import { PlanPaymentRepository } from '@gitroom/nestjs-libraries/database/prisma/plans/plan-payment.repository';

@Controller()
export class PostsController {
  constructor(
    private _postsService: PostsService,
    private _webhooksService: WebhooksService,
    private _autopostsService: AutopostService
    ,
    private _planPaymentRepository: PlanPaymentRepository
  ) {}

  @EventPattern('post', Transport.REDIS)
  async post(data: { id: string }) {
    console.log('processing', data);
    try {
      return await this._postsService.post(data.id);
    } catch (err) {
      console.log("Unhandled error, let's avoid crashing the post worker", err);
    }
  }

  @EventPattern('submit', Transport.REDIS)
  async payout(data: { id: string; releaseURL: string }) {
    try {
      return await this._postsService.payout(data.id, data.releaseURL);
    } catch (err) {
      console.log(
        "Unhandled error, let's avoid crashing the submit worker",
        err
      );
    }
  }

  @EventPattern('sendDigestEmail', Transport.REDIS)
  async sendDigestEmail(data: { subject: string; org: string; since: string }) {
    try {
      return await this._postsService.sendDigestEmail(
        data.subject,
        data.org,
        data.since
      );
    } catch (err) {
      console.log(
        "Unhandled error, let's avoid crashing the digest worker",
        err
      );
    }
  }

  @EventPattern('webhooks', Transport.REDIS)
  async webhooks(data: { org: string; since: string }) {
    try {
      return await this._webhooksService.fireWebhooks(data.org, data.since);
    } catch (err) {
      console.log(
        "Unhandled error, let's avoid crashing the webhooks worker",
        err
      );
    }
  }

  @EventPattern('lp.checkout', Transport.REDIS)
  async handleLpCheckout(data: { payload: any; idempotencyKey?: string | null }) {
    try {
      const payload = data.payload || {};

      // Minimal mapping: create a PlanPayment record so Otomatisin has the order
      const merchantOrderId = payload.merchantOrderId || payload.order_id || payload.id || null;
      const orgId = payload.organizationId || payload.orgId || payload.org || payload.organization || null;
      const planId = payload.planId || payload.plan_id || null;
      const amount = payload.amount ? Number(payload.amount) : payload.total ? Number(payload.total) : 0;
      const currency = payload.currency || 'IDR';

      if (!merchantOrderId || !orgId) {
        // store as webhook-only event or skip
        console.log('lp.checkout missing merchantOrderId or orgId', payload);
        return;
      }

      // Check if already exists (idempotency)
      const existing = await this._planPaymentRepository.getPaymentByMerchantOrderId(merchantOrderId);
      if (existing) {
        console.log('lp.checkout duplicate merchantOrderId, skipping', merchantOrderId);
        return existing;
      }

      const created = await this._planPaymentRepository.createPayment({
        organizationId: orgId,
        planId: planId || undefined,
        status: 'PENDING' as any,
        amount: amount,
        currency: currency,
        provider: 'DUITKU' as any,
        merchantOrderId: merchantOrderId,
        requestPayload: payload,
      });

      console.log('lp.checkout created payment', created.id);

      return created;
    } catch (err) {
      console.error('Error processing lp.checkout', err);
    }
  }

  @EventPattern('cron', Transport.REDIS)
  async cron(data: { id: string }) {
    try {
      return await this._autopostsService.startAutopost(data.id);
    } catch (err) {
      console.log(
        "Unhandled error, let's avoid crashing the autopost worker",
        err
      );
    }
  }
}
