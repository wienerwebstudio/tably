import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZQuery } from '../../common/zod';
import { Can, Member, Tenant } from '../../common/guards';
import type { TenantContext } from '../../common/auth.types';
import { AnalyticsService } from './analytics.service';

const querySchema = z.object({
  days: z.enum(['7', '30', '90']).default('30'),
  locationId: z.string().max(40).optional(),
  programId: z.string().max(40).optional(),
});

@ApiTags('Analysen')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Can('analytics.read')
  overview(@Tenant() ctx: TenantContext, @ZQuery(querySchema) query: z.infer<typeof querySchema>) {
    return this.analytics.overview(ctx, { days: Number(query.days) as 7 | 30 | 90, locationId: query.locationId, programId: query.programId });
  }

  @Get('today')
  @Member()
  today(@Tenant() ctx: TenantContext) {
    return this.analytics.today(ctx);
  }
}
