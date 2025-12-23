import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { PostsRepository } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.repository';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';

type ThreadsReply = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  permalink?: string;
};

@Injectable()
export class ThreadsInboxService {
  constructor(
    private _integrationRepository: IntegrationRepository,
    private _postsRepository: PostsRepository,
    private _refreshIntegrationService: RefreshIntegrationService
  ) {}

  listChannels(orgId: string) {
    return this._integrationRepository.getIntegrationsByProvider(orgId, 'threads');
  }

  async getReplies(
    orgId: string,
    integrationId: string,
    postLimit = 10,
    replyLimit = 20
  ) {
    const integration = await this._integrationRepository.getIntegrationById(
      orgId,
      integrationId
    );
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    if (integration.providerIdentifier !== 'threads') {
      throw new BadRequestException('Integration is not Threads');
    }

    let accessToken = integration.token;
    if (
      integration.tokenExpiration &&
      dayjs(integration.tokenExpiration).isBefore(dayjs())
    ) {
      const refreshed = await this._refreshIntegrationService.refresh(integration);
      if (!refreshed) {
        return {
          integration: {
            id: integration.id,
            name: integration.name,
            profile: integration.profile,
            picture: integration.picture,
            providerIdentifier: integration.providerIdentifier,
          },
          posts: [],
          lastSync: new Date().toISOString(),
          error: 'refresh_needed',
        };
      }
      accessToken = refreshed.accessToken;
    }

    const safePostLimit = this.clamp(postLimit, 1, 25);
    const safeReplyLimit = this.clamp(replyLimit, 1, 50);

    const posts = await this._postsRepository.getPublishedPostsByIntegration(
      orgId,
      integrationId,
      safePostLimit
    );

    const postsWithReplies = [];
    for (const post of posts) {
      if (!post.releaseId) {
        continue;
      }
      const replies = await this.fetchReplies(
        post.releaseId,
        accessToken,
        safeReplyLimit
      );
      postsWithReplies.push({
        id: post.id,
        content: post.content,
        publishDate: post.publishDate,
        releaseId: post.releaseId,
        releaseURL: post.releaseURL,
        image: post.image,
        replies,
      });
    }

    return {
      integration: {
        id: integration.id,
        name: integration.name,
        profile: integration.profile,
        picture: integration.picture,
        providerIdentifier: integration.providerIdentifier,
      },
      posts: postsWithReplies,
      lastSync: new Date().toISOString(),
    };
  }

  private async fetchReplies(
    threadId: string,
    accessToken: string,
    limit: number
  ): Promise<ThreadsReply[]> {
    const params = new URLSearchParams({
      fields: 'id,text,username,timestamp,permalink',
      limit: String(limit),
      access_token: accessToken,
    });

    const url = `https://graph.threads.net/v1.0/${threadId}/replies?${params.toString()}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return Array.isArray(data?.data) ? data.data : [];
    } catch {
      return [];
    }
  }

  private clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }
}
