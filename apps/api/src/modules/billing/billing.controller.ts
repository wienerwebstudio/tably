import { Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { changePlanSchema } from '@tably/types';
import { ApiZodBody, ZBody } from '../../common/zod';
import { Can, Member, Tenant } from '../../common/guards';
import type { AppRequest, TenantContext } from '../../common/auth.types';
import { AppError } from '../../common/errors';
import { BillingService } from './billing.service';

const simulateSchema = z.object({ event: z.enum(['payment_failed', 'payment_succeeded', 'grace_expired']) });

@ApiTags('Abrechnung')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @Member()
  overview(@Tenant() ctx: TenantContext) {
    return this.billing.overview(ctx);
  }

  @Post('change-plan')
  @HttpCode(200)
  @Can('billing.manage', { allowRestricted: true })
  @ApiOperation({ summary: 'Tarif wählen oder wechseln. Mit Stripe: Checkout-URL; im Testmodus: sofort wirksam.' })
  @ApiZodBody(changePlanSchema)
  changePlan(@Tenant() ctx: TenantContext, @ZBody(changePlanSchema) body: z.infer<typeof changePlanSchema>) {
    return this.billing.changePlan(ctx, body.planId, body.interval);
  }

  @Post('cancel')
  @HttpCode(200)
  @Can('billing.manage', { allowRestricted: true })
  async cancel(@Tenant() ctx: TenantContext) {
    await this.billing.setCancel(ctx, true);
    return { ok: true };
  }

  @Post('resume')
  @HttpCode(200)
  @Can('billing.manage', { allowRestricted: true })
  async resume(@Tenant() ctx: TenantContext) {
    await this.billing.setCancel(ctx, false);
    return { ok: true };
  }

  @Post('portal')
  @HttpCode(200)
  @Can('billing.manage', { allowRestricted: true })
  portal(@Tenant() ctx: TenantContext) {
    return this.billing.portalUrl(ctx);
  }

  @Post('test/simulate')
  @HttpCode(200)
  @Can('billing.manage', { allowRestricted: true })
  @ApiOperation({ summary: 'NUR TESTMODUS: Zahlungsereignis nachstellen' })
  async simulate(@Tenant() ctx: TenantContext, @ZBody(simulateSchema) body: z.infer<typeof simulateSchema>) {
    await this.billing.simulate(ctx, body.event);
    return { ok: true };
  }

  @Post('webhooks/stripe')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async stripeWebhook(@Req() req: AppRequest, @Headers('stripe-signature') signature: string | undefined) {
    if (!req.rawBody) throw new AppError('validation_failed', 'Leerer Webhook.');
    return this.billing.handleStripeWebhook(req.rawBody, signature);
  }
}
