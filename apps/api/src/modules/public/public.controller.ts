import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { CUSTOMER_COOKIE } from '@tapperl/config';
import { cardRecoverySchema, contactSchema, customerRedeemRequestSchema, customerSelfUpdateSchema, enrollSchema, tapSchema, tokenSchema } from '@tapperl/types';
import { ApiZodBody, ZBody } from '../../common/zod';
import { Browser } from '../../common/guards';
import { clientIp, userAgent, type AppRequest, type CustomerBrowser } from '../../common/auth.types';
import { SessionService } from '../../common/session.service';
import { TapsService } from '../nfc/taps.service';
import { PublicService } from './public.service';

const meta = (req: AppRequest) => ({ ip: clientIp(req), userAgent: userAgent(req) });
const recoverSchema = cardRecoverySchema.extend({ orgSlug: z.string().min(1).max(60) });
const accessSchema = z.object({ token: z.string().min(20).max(200) });

@ApiTags('Kundenkarte (öffentlich)')
@Controller('public')
export class PublicController {
  constructor(
    private readonly service: PublicService,
    private readonly taps: TapsService,
    private readonly sessions: SessionService,
  ) {}

  private token(req: AppRequest, res: Response): string {
    return this.sessions.ensureCustomerToken(res, req.cookies?.[CUSTOMER_COOKIE]);
  }

  @Get('status')
  status() {
    return this.service.status();
  }

  @Get('plans')
  plans() {
    return this.service.plans();
  }

  @Post('contact')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @ApiZodBody(contactSchema)
  async contact(@ZBody(contactSchema) body: z.infer<typeof contactSchema>, @Req() req: AppRequest) {
    await this.service.contact(body, clientIp(req));
    return { ok: true };
  }

  @Get('programs/:orgSlug/:programSlug')
  program(@Param('orgSlug') orgSlug: string, @Param('programSlug') programSlug: string, @Browser() browser: CustomerBrowser) {
    return this.service.program(orgSlug, programSlug, browser);
  }

  @Post('programs/:orgSlug/:programSlug/enroll')
  @HttpCode(200)
  // Großzügig, weil Gäste im WLAN eines Geschäfts dieselbe IP teilen
  @Throttle({ default: { limit: 60, ttl: 600_000 } })
  @ApiOperation({ summary: 'Kundenkonto und Karte anlegen; optional einen offenen Tap einlösen' })
  @ApiZodBody(enrollSchema)
  enroll(
    @Param('orgSlug') orgSlug: string,
    @Param('programSlug') programSlug: string,
    @ZBody(enrollSchema) body: z.infer<typeof enrollSchema>,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.enroll(orgSlug, programSlug, body, this.token(req, res), meta(req));
  }

  @Post('taps')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'NFC-Tap einreichen (Parameter aus der vom Chip gelieferten URL)' })
  @ApiZodBody(tapSchema)
  tap(@ZBody(tapSchema) body: z.infer<typeof tapSchema>, @Browser() browser: CustomerBrowser, @Req() req: AppRequest) {
    return this.taps.submit({ publicId: body.deviceId, e: body.e.toUpperCase(), c: body.c.toUpperCase(), browserTokenHash: browser.tokenHash, ip: clientIp(req) });
  }

  @Get('taps/:token')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  tapStatus(@Param('token') token: string) {
    return this.taps.status(token);
  }

  @Get('cards')
  myCards(@Browser() browser: CustomerBrowser) {
    return this.service.myCards(browser);
  }

  @Get('cards/:id')
  card(@Browser() browser: CustomerBrowser, @Param('id') id: string) {
    return this.service.card(browser, id);
  }

  @Patch('cards/:id/profile')
  @ApiZodBody(customerSelfUpdateSchema)
  updateProfile(@Browser() browser: CustomerBrowser, @Param('id') id: string, @ZBody(customerSelfUpdateSchema) body: z.infer<typeof customerSelfUpdateSchema>, @Req() req: AppRequest) {
    return this.service.updateProfile(browser, id, body, meta(req));
  }

  @Post('cards/:id/redemptions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Einlöse-Code für eine Prämie erzeugen (5 Minuten gültig)' })
  redeem(@Browser() browser: CustomerBrowser, @Param('id') id: string, @ZBody(customerRedeemRequestSchema) body: z.infer<typeof customerRedeemRequestSchema>) {
    return this.service.requestRedemption(browser, id, body.rewardId);
  }

  @Delete('cards/:id/redemptions')
  async cancelRedemption(@Browser() browser: CustomerBrowser, @Param('id') id: string) {
    await this.service.cancelRedemption(browser, id);
    return { ok: true };
  }

  @Get('cards/:id/export')
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  exportData(@Browser() browser: CustomerBrowser, @Param('id') id: string) {
    return this.service.exportMyData(browser, id);
  }

  @Delete('cards/:id')
  @ApiOperation({ summary: 'Eigene Daten löschen (Art. 17 DSGVO)' })
  async deleteData(@Browser() browser: CustomerBrowser, @Param('id') id: string) {
    await this.service.deleteMyData(browser, id);
    return { ok: true };
  }

  @Post('access')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  access(@ZBody(accessSchema) body: z.infer<typeof accessSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    return this.service.accessByToken(body.token, this.token(req, res), meta(req));
  }

  @Post('recover')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async recover(@ZBody(recoverSchema) body: z.infer<typeof recoverSchema>) {
    await this.service.recover(body.orgSlug, body.email);
    return { ok: true };
  }

  @Post('recover/consume')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  consume(@ZBody(tokenSchema) body: z.infer<typeof tokenSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    return this.service.consumeRecovery(body.token, this.token(req, res), meta(req));
  }

  @Get('assets/:id')
  async asset(@Param('id') id: string, @Res() res: Response) {
    const asset = await this.service.asset(id);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(Buffer.from(asset.data));
  }

  @Get('organizations/:slug/icon.png')
  async icon(@Param('slug') slug: string, @Res() res: Response) {
    const icon = await this.service.organizationIcon(slug);
    res.setHeader('Content-Type', icon.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(icon.data);
  }
}
