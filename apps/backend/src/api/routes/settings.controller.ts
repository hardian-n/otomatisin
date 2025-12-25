import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { StarsService } from '@gitroom/nestjs-libraries/database/prisma/stars/stars.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import { ApiTags } from '@nestjs/swagger';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { ThirdPartyService } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.service';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';

@ApiTags('Settings')
@Controller('/settings')
export class SettingsController {
  constructor(
    private _starsService: StarsService,
    private _organizationService: OrganizationService,
    private _thirdPartyService: ThirdPartyService,
    private _integrationService: IntegrationService
  ) {}

  @Get('/github')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async getConnectedGithubAccounts(@GetOrgFromRequest() org: Organization) {
    return {
      github: (
        await this._starsService.getGitHubRepositoriesByOrgId(org.id)
      ).map((repo) => ({
        id: repo.id,
        login: repo.login,
      })),
    };
  }

  @Post('/github')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async addGitHub(
    @GetOrgFromRequest() org: Organization,
    @Body('code') code: string
  ) {
    if (!code) {
      throw new Error('No code provided');
    }
    await this._starsService.addGitHub(org.id, code);
  }

  @Get('/github/url')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  authUrl() {
    return {
      url: `https://github.com/login/oauth/authorize?client_id=${
        process.env.GITHUB_CLIENT_ID
      }&scope=${encodeURIComponent(
        'user:email'
      )}&redirect_uri=${encodeURIComponent(
        `${process.env.FRONTEND_URL}/settings`
      )}`,
    };
  }

  @Get('/organizations/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async getOrganizations(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return {
      organizations: await this._starsService.getOrganizations(org.id, id),
    };
  }

  @Get('/organizations/:id/:github')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async getRepositories(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Param('github') github: string
  ) {
    return {
      repositories: await this._starsService.getRepositoriesOfOrganization(
        org.id,
        id,
        github
      ),
    };
  }

  @Post('/organizations/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async updateGitHubLogin(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body('login') login: string
  ) {
    return this._starsService.updateGitHubLogin(org.id, id, login);
  }

  @Delete('/repository/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async deleteRepository(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._starsService.deleteRepository(org.id, id);
  }

  @Get('/team')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async getTeam(@GetOrgFromRequest() org: Organization) {
    return this._organizationService.getTeam(org.id);
  }

  @Post('/team')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async inviteTeamMember(
    @GetOrgFromRequest() org: Organization,
    @Body() body: AddTeamMemberDto
  ) {
    return this._organizationService.inviteTeamMember(org.id, body);
  }

  @Delete('/team/:id')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  deleteTeamMember(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._organizationService.deleteTeamMember(org, id);
  }

  @Get('/telegram')
  async getTelegramSettings(@GetOrgFromRequest() org: Organization) {
    const existing = await this._thirdPartyService.getIntegrationByIdentifier(
      org.id,
      'telegram_bot'
    );
    if (!existing) {
      return { botName: '', botToken: '' };
    }

    return {
      botName: existing.name || '',
      botToken: existing.apiKey
        ? AuthService.fixedDecryption(existing.apiKey)
        : '',
    };
  }

  @Post('/telegram')
  async saveTelegramSettings(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { botName?: string; botToken?: string }
  ) {
    const botName = (body.botName || '').trim();
    const botToken = (body.botToken || '').trim();
    if (!botName || !botToken) {
      throw new Error('Telegram bot name and token are required');
    }

    await this._thirdPartyService.saveIntegration(
      org.id,
      'telegram_bot',
      botToken,
      {
        name: botName,
        username: botName,
        id: 'telegram_bot',
      }
    );

    return { ok: true };
  }

  @Get('/x')
  async getXSettings(@GetOrgFromRequest() org: Organization) {
    const existing = await this._thirdPartyService.getIntegrationByIdentifier(
      org.id,
      'x_app'
    );
    if (!existing?.apiKey) {
      return { apiKey: '', apiSecret: '' };
    }

    let apiKey = '';
    let apiSecret = '';
    try {
      const decrypted = AuthService.fixedDecryption(existing.apiKey);
      const parsed = JSON.parse(decrypted);
      apiKey = (parsed?.apiKey || parsed?.client_id || '').trim();
      apiSecret = (parsed?.apiSecret || parsed?.client_secret || '').trim();
    } catch {
      apiKey = '';
      apiSecret = '';
    }

    return { apiKey, apiSecret };
  }

  @Post('/x')
  async saveXSettings(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { apiKey?: string; apiSecret?: string }
  ) {
    const apiKey = (body.apiKey || '').trim();
    const apiSecret = (body.apiSecret || '').trim();
    if (!apiKey || !apiSecret) {
      throw new Error('X API key and secret are required');
    }

    await this._thirdPartyService.saveIntegration(
      org.id,
      'x_app',
      JSON.stringify({ apiKey, apiSecret }),
      {
        name: 'X App',
        username: 'x_app',
        id: 'x_app',
      }
    );

    await this._integrationService.updateCustomInstanceDetailsByProvider(
      org.id,
      'x',
      AuthService.fixedEncryption(JSON.stringify({ apiKey, apiSecret }))
    );

    return { ok: true };
  }
}
