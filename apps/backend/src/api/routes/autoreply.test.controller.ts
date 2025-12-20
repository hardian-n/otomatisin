import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { AutoreplyService } from '@gitroom/backend/services/autoreply/autoreply.service';

class AutoreplyTestDto {
  @IsString()
  organization_id!: string;

  @IsString()
  channel!: string;

  @IsOptional()
  @IsString()
  integration_id?: string | null;

  @IsOptional()
  @IsString()
  channel_target_id?: string | null;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  author_id?: string | null;

  @IsOptional()
  @IsString()
  message_id?: string | null;

  @IsOptional()
  @IsBoolean()
  multi_reply?: boolean;
}

@ApiTags('Autoreply')
@Controller('/api/autoreply')
export class AutoreplyTestController {
  constructor(private readonly autoreplyService: AutoreplyService) {}

  @Post('/test')
  async test(@Body() body: AutoreplyTestDto) {
    const result = await this.autoreplyService.evaluateTest({
      orgId: body.organization_id,
      channel: body.channel,
      integrationId: body.integration_id,
      channelTargetId: body.channel_target_id,
      text: body.text,
      authorId: body.author_id,
      messageId: body.message_id,
      multiReply: body.multi_reply,
    });

    if (!result.matched || !result.replies.length) {
      return { matched: false };
    }

    const best = result.replies[0];
    return {
      matched: true,
      rule_id: best.ruleId,
      reply_text: best.replyText,
      scheduled_in_sec: best.scheduledInSec,
      replies: result.replies,
    };
  }
}
