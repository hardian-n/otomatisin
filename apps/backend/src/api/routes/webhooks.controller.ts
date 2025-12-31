import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Headers,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { BullMqClient } from '@gitroom/nestjs-libraries/bull-mq-transport-new/client';
import * as crypto from 'crypto';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  UpdateDto,
  WebhooksDto,
} from '@gitroom/nestjs-libraries/dtos/webhooks/webhooks.dto';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@ApiTags('Webhooks')
@Controller('/webhooks')
export class WebhookController {
  constructor(
    private _webhooksService: WebhooksService,
    private _workerServiceProducer: BullMqClient
  ) {}

  @Get('/')
  async getStatistics(@GetOrgFromRequest() org: Organization) {
    return this._webhooksService.getWebhooks(org.id);
  }

  @Post('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.WEBHOOKS])
  async createAWebhook(
    @GetOrgFromRequest() org: Organization,
    @Body() body: WebhooksDto
  ) {
    return this._webhooksService.createWebhook(org.id, body);
  }

  @Put('/')
  async updateWebhook(
    @GetOrgFromRequest() org: Organization,
    @Body() body: UpdateDto
  ) {
    return this._webhooksService.createWebhook(org.id, body);
  }

  @Delete('/:id')
  async deleteWebhook(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._webhooksService.deleteWebhook(org.id, id);
  }

  @Post('/send')
  async sendWebhook(@Body() body: any, @Query('url') url: string) {
    try {
      await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      /** sent **/
    }

    return { send: true };
  }

  // Public endpoint: receive checkout events from landing page (otomatisin-lp)
  @Post('/lp-checkout')
  async lpCheckout(
    @Headers('x-signature') signature: string,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: any
  ) {
    const secret = process.env.OTOMATISIN_WEBHOOK_SECRET || '';
    const payload = JSON.stringify(body || {});
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // timingSafeEqual requires buffers of same length
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature || '');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error('invalid signature');
      }
    } catch (err) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Dispatch job to queue for reliable processing
    await this._workerServiceProducer.dispatchEvent({
      pattern: 'lp.checkout',
      data: {
        payload: body,
        idempotencyKey: idempotencyKey || null,
      },
    });

    return { received: true };
  }
}
