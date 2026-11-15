import { Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { campaignInputSchema, segmentSchema } from '@tably/types';
import { ApiZodBody, ZBody } from '../../common/zod';
import { Can, CurrentAuth, Tenant } from '../../common/guards';
import type { AuthContext, TenantContext } from '../../common/auth.types';
import { CampaignsService } from './campaigns.service';

@ApiTags('Marketing')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @Can('campaigns.manage')
  list(@Tenant() ctx: TenantContext) {
    return this.campaigns.list(ctx);
  }

  @Post('audience')
  @HttpCode(200)
  @Can('campaigns.manage')
  @ApiOperation({ summary: 'Größe einer Zielgruppe berechnen (inkl. Einwilligungen)' })
  audience(@Tenant() ctx: TenantContext, @ZBody(segmentSchema) body: z.infer<typeof segmentSchema>) {
    return this.campaigns.audience(ctx, body);
  }

  @Post()
  @Can('campaigns.manage')
  @ApiZodBody(campaignInputSchema)
  create(@Tenant() ctx: TenantContext, @ZBody(campaignInputSchema) body: z.infer<typeof campaignInputSchema>) {
    return this.campaigns.create(ctx, body);
  }

  @Get(':id')
  @Can('campaigns.manage')
  get(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.campaigns.get(ctx, id);
  }

  @Put(':id')
  @Can('campaigns.manage')
  update(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(campaignInputSchema) body: z.infer<typeof campaignInputSchema>) {
    return this.campaigns.update(ctx, id, body);
  }

  @Delete(':id')
  @Can('campaigns.manage')
  async remove(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    await this.campaigns.remove(ctx, id);
    return { ok: true };
  }

  @Post(':id/launch')
  @HttpCode(200)
  @Can('campaigns.manage')
  launch(@Tenant() ctx: TenantContext, @CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.campaigns.launch(ctx, id, auth.user.emailVerified);
  }

  @Post(':id/pause')
  @HttpCode(200)
  @Can('campaigns.manage')
  pause(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.campaigns.setPaused(ctx, id, true);
  }

  @Post(':id/resume')
  @HttpCode(200)
  @Can('campaigns.manage')
  resume(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.campaigns.setPaused(ctx, id, false);
  }

  @Post(':id/end')
  @HttpCode(200)
  @Can('campaigns.manage')
  end(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.campaigns.end(ctx, id);
  }
}
