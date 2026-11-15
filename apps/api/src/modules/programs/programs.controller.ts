import { Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { createProgramSchema, programStatusSchema, rewardInputSchema, rewardUpdateSchema, updateProgramSchema } from '@tably/types';
import { ApiZodBody, ZBody } from '../../common/zod';
import { Can, CurrentAuth, Member, Tenant } from '../../common/guards';
import type { AuthContext, TenantContext } from '../../common/auth.types';
import { ProgramsService } from './programs.service';

@ApiTags('Treueprogramme')
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  @Member()
  list(@Tenant() ctx: TenantContext) {
    return this.programs.list(ctx);
  }

  @Post()
  @Can('programs.manage')
  @ApiZodBody(createProgramSchema)
  create(@Tenant() ctx: TenantContext, @ZBody(createProgramSchema) body: z.infer<typeof createProgramSchema>) {
    return this.programs.create(ctx, body);
  }

  @Get(':id')
  @Member()
  get(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.programs.get(ctx, id);
  }

  @Patch(':id')
  @Can('programs.manage')
  @ApiZodBody(updateProgramSchema)
  update(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(updateProgramSchema) body: z.infer<typeof updateProgramSchema>) {
    return this.programs.update(ctx, id, body);
  }

  @Put(':id/status')
  @Can('programs.manage')
  setStatus(@Tenant() ctx: TenantContext, @CurrentAuth() auth: AuthContext, @Param('id') id: string, @ZBody(programStatusSchema) body: z.infer<typeof programStatusSchema>) {
    return this.programs.setStatus(ctx, id, body.status, auth.user.emailVerified);
  }

  @Post(':id/rewards')
  @Can('programs.manage')
  @ApiZodBody(rewardInputSchema)
  addReward(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(rewardInputSchema) body: z.infer<typeof rewardInputSchema>) {
    return this.programs.addReward(ctx, id, body);
  }

  @Patch(':id/rewards/:rewardId')
  @Can('programs.manage')
  updateReward(@Tenant() ctx: TenantContext, @Param('id') id: string, @Param('rewardId') rewardId: string, @ZBody(rewardUpdateSchema) body: z.infer<typeof rewardUpdateSchema>) {
    return this.programs.updateReward(ctx, id, rewardId, body);
  }

  @Delete(':id/rewards/:rewardId')
  @Can('programs.manage')
  async removeReward(@Tenant() ctx: TenantContext, @Param('id') id: string, @Param('rewardId') rewardId: string) {
    await this.programs.removeReward(ctx, id, rewardId);
    return { ok: true };
  }
}
