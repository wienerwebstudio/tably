import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PKPASS_MIME } from '@tapperl/wallet';
import { Browser, Member, Tenant } from '../../common/guards';
import type { CustomerBrowser, TenantContext } from '../../common/auth.types';
import { AppError } from '../../common/errors';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@Controller()
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('wallet/status')
  @Member()
  @ApiOperation({ summary: 'Integrationsstatus: zeigt ehrlich, ob Apple/Google Wallet eingerichtet sind' })
  status(@Tenant() ctx: TenantContext) {
    return this.wallet.status(ctx.organizationId);
  }

  @Get('public/cards/:id/wallet/apple')
  async applePass(@Browser() browser: CustomerBrowser, @Param('id') id: string, @Res() res: Response) {
    const pkpass = await this.wallet.applePassForCustomer(browser, id);
    res.setHeader('Content-Type', PKPASS_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="treuekarte.pkpass"');
    res.end(pkpass);
  }

  @Get('public/cards/:id/wallet/google')
  googleLink(@Browser() browser: CustomerBrowser, @Param('id') id: string) {
    return this.wallet.googleSaveUrlForCustomer(browser, id);
  }

  // ── Apple-Pass-Webservice (wird von Wallet auf dem iPhone aufgerufen) ──
  @Post('wallet/apple/v1/devices/:device/registrations/:passType/:serial')
  async register(
    @Param('device') device: string,
    @Param('passType') passType: string,
    @Param('serial') serial: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { pushToken?: unknown },
    @Res() res: Response,
  ) {
    if (typeof body?.pushToken !== 'string' || !/^[0-9a-fA-F]{32,200}$/.test(body.pushToken)) throw new AppError('validation_failed', 'pushToken fehlt.');
    const result = await this.wallet.registerDevice(device.slice(0, 100), passType, serial, authorization, body.pushToken);
    res.status(result === 'created' ? 201 : 200).end();
  }

  @Delete('wallet/apple/v1/devices/:device/registrations/:passType/:serial')
  @HttpCode(200)
  async unregister(@Param('device') device: string, @Param('passType') passType: string, @Param('serial') serial: string, @Headers('authorization') authorization: string | undefined) {
    await this.wallet.unregisterDevice(device, passType, serial, authorization);
  }

  @Get('wallet/apple/v1/devices/:device/registrations/:passType')
  async serials(@Param('device') device: string, @Param('passType') passType: string, @Query('passesUpdatedSince') since: string | undefined, @Res() res: Response) {
    const result = await this.wallet.updatedSerials(device, passType, since);
    if (!result) res.status(204).end();
    else res.status(200).json(result);
  }

  @Get('wallet/apple/v1/passes/:passType/:serial')
  async pass(
    @Param('passType') passType: string,
    @Param('serial') serial: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('if-modified-since') ifModifiedSince: string | undefined,
    @Res() res: Response,
  ) {
    const { pkpass, updatedAt } = await this.wallet.latestPass(passType, serial, authorization);
    if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= Math.floor(updatedAt.getTime() / 1000) * 1000) {
      res.status(304).end();
      return;
    }
    res.setHeader('Content-Type', PKPASS_MIME);
    res.setHeader('Last-Modified', updatedAt.toUTCString());
    res.end(pkpass);
  }

  @Post('wallet/apple/v1/log')
  @HttpCode(200)
  async log(@Body() body: { logs?: unknown }) {
    const logs = Array.isArray(body?.logs) ? body.logs.filter((l): l is string => typeof l === 'string').slice(0, 20) : [];
    await this.wallet.deviceLog(logs);
  }
}
