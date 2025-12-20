import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AutoreplyService } from '@gitroom/backend/services/autoreply/autoreply.service';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AutoreplyMatchType } from '@prisma/client';

class EvaluateDto {
  @IsString()
  channel!: string;

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

class UpsertRuleDto {
  @IsString()
  channel!: string;

  @IsOptional()
  @IsString()
  integration_id?: string | null;

  @IsOptional()
  @IsString()
  channel_target_id?: string | null;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsString()
  keyword_pattern!: string;

  @IsIn(['EXACT', 'CONTAINS', 'REGEX'])
  match_type!: AutoreplyMatchType;

  @IsString()
  reply_text!: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  delay_sec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  cooldown_sec?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

@ApiTags('Autoreply')
@Controller('/v1/autoreply')
export class AutoreplyController {
  constructor(private readonly autoreplyService: AutoreplyService) {}

  @Post('/evaluate')
  async evaluate(@Req() req: Request, @Body() body: EvaluateDto) {
    const orgId = (req as any).org?.id as string;
    const result = await this.autoreplyService.evaluate({
      orgId,
      channel: body.channel,
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

  @Get('/rules')
  async listRules(@Req() req: Request, @Query('channel') channel?: string) {
    const orgId = (req as any).org?.id as string;
    return this.autoreplyService.listRules(orgId, channel);
  }

  @Post('/rules')
  async createRule(@Req() req: Request, @Body() body: UpsertRuleDto) {
    const orgId = (req as any).org?.id as string;
    return this.autoreplyService.createRule(orgId, {
      channel: body.channel,
      integrationId: body.integration_id,
      channelTargetId: body.channel_target_id,
      name: body.name,
      keywordPattern: body.keyword_pattern,
      matchType: body.match_type,
      replyText: body.reply_text,
      priority: body.priority,
      delaySec: body.delay_sec,
      cooldownSec: body.cooldown_sec,
      isActive: body.is_active,
    } as any);
  }

  @Put('/rules/:id')
  async updateRule(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpsertRuleDto
  ) {
    const orgId = (req as any).org?.id as string;
    return this.autoreplyService.updateRule(id, orgId, {
      channel: body.channel,
      integrationId: body.integration_id,
      channelTargetId: body.channel_target_id,
      name: body.name,
      keywordPattern: body.keyword_pattern,
      matchType: body.match_type,
      replyText: body.reply_text,
      priority: body.priority,
      delaySec: body.delay_sec,
      cooldownSec: body.cooldown_sec,
      isActive: body.is_active,
    } as any);
  }

  @Delete('/rules/:id')
  async deleteRule(@Req() req: Request, @Param('id') id: string) {
    const orgId = (req as any).org?.id as string;
    return this.autoreplyService.deleteRule(id, orgId);
  }
}
