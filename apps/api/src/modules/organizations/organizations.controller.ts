import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { createApiKeySchema, inviteMemberSchema, locationSchema, locationUpdateSchema, paginationSchema, updateMemberSchema, updateOrganizationSchema } from '@tapperl/types';
import { ApiZodBody, ZBody, ZQuery } from '../../common/zod';
import { Can, Member, Tenant } from '../../common/guards';
import type { TenantContext } from '../../common/auth.types';
import { EntitlementsService } from '../../common/entitlements.service';
import { OrganizationsService } from './organizations.service';

const logoSchema = z.object({ dataBase64: z.string().min(10).max(800_000) });

@ApiTags('Organisation')
@Controller('organization')
export class OrganizationsController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  @Member()
  get(@Tenant() ctx: TenantContext) {
    return this.orgs.get(ctx);
  }

  @Patch()
  @Can('org.manage')
  @ApiZodBody(updateOrganizationSchema)
  update(@Tenant() ctx: TenantContext, @ZBody(updateOrganizationSchema) body: z.infer<typeof updateOrganizationSchema>) {
    return this.orgs.update(ctx, body);
  }

  @Put('logo')
  @Can('org.manage')
  setLogo(@Tenant() ctx: TenantContext, @ZBody(logoSchema) body: z.infer<typeof logoSchema>) {
    return this.orgs.setLogo(ctx, body.dataBase64);
  }

  @Delete('logo')
  @Can('org.manage')
  async removeLogo(@Tenant() ctx: TenantContext) {
    await this.orgs.removeLogo(ctx);
    return { ok: true };
  }

  @Get('usage')
  @Member()
  async usage(@Tenant() ctx: TenantContext) {
    const [eff, usage] = await Promise.all([this.entitlements.get(ctx.organizationId), this.entitlements.usage(ctx.organizationId)]);
    return { limits: eff.limits, usage, features: eff.features };
  }

  @Get('onboarding')
  @Member()
  onboarding(@Tenant() ctx: TenantContext) {
    return this.orgs.onboarding(ctx);
  }

  @Post('onboarding/complete')
  @HttpCode(200)
  @Can('org.manage', { allowRestricted: true })
  async completeOnboarding(@Tenant() ctx: TenantContext) {
    await this.orgs.completeOnboarding(ctx);
    return { ok: true };
  }

  @Get('locations')
  @Member()
  locations(@Tenant() ctx: TenantContext) {
    return this.orgs.listLocations(ctx);
  }

  @Post('locations')
  @Can('locations.manage')
  @ApiZodBody(locationSchema)
  createLocation(@Tenant() ctx: TenantContext, @ZBody(locationSchema) body: z.infer<typeof locationSchema>) {
    return this.orgs.createLocation(ctx, body);
  }

  @Patch('locations/:id')
  @Can('locations.manage')
  updateLocation(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(locationUpdateSchema) body: z.infer<typeof locationUpdateSchema>) {
    return this.orgs.updateLocation(ctx, id, body);
  }

  @Get('members')
  @Can('members.manage')
  members(@Tenant() ctx: TenantContext) {
    return this.orgs.listMembers(ctx);
  }

  @Post('invitations')
  @Can('members.manage')
  @ApiZodBody(inviteMemberSchema)
  invite(@Tenant() ctx: TenantContext, @ZBody(inviteMemberSchema) body: z.infer<typeof inviteMemberSchema>) {
    return this.orgs.invite(ctx, body);
  }

  @Delete('invitations/:id')
  @Can('members.manage')
  async revokeInvitation(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    await this.orgs.revokeInvitation(ctx, id);
    return { ok: true };
  }

  @Patch('members/:id')
  @Can('members.manage')
  updateMember(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(updateMemberSchema) body: z.infer<typeof updateMemberSchema>) {
    return this.orgs.updateMemberRole(ctx, id, body.role);
  }

  @Delete('members/:id')
  @Can('members.manage')
  async removeMember(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    await this.orgs.removeMember(ctx, id);
    return { ok: true };
  }

  @Get('api-keys')
  @Can('apikeys.manage')
  apiKeys(@Tenant() ctx: TenantContext) {
    return this.orgs.listApiKeys(ctx);
  }

  @Post('api-keys')
  @Can('apikeys.manage')
  createApiKey(@Tenant() ctx: TenantContext, @ZBody(createApiKeySchema) body: z.infer<typeof createApiKeySchema>) {
    return this.orgs.createApiKey(ctx, body.name);
  }

  @Delete('api-keys/:id')
  @Can('apikeys.manage')
  async revokeApiKey(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    await this.orgs.revokeApiKey(ctx, id);
    return { ok: true };
  }

  @Get('audit')
  @Can('audit.read')
  audit(@Tenant() ctx: TenantContext, @ZQuery(paginationSchema) query: z.infer<typeof paginationSchema>) {
    return this.orgs.auditLog(ctx, query.page, query.pageSize);
  }
}
