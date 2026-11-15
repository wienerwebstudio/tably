import { Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { z } from 'zod';
import { createDeviceSchema, deviceStatusSchema, posEventSchema, tapDecisionSchema, updateDeviceSchema } from '@tably/types';
import { ApiZodBody, ZBody } from '../../common/zod';
import { ApiKeyAuth, ApiKeyCtx, Can, Tenant } from '../../common/guards';
import type { ApiKeyContext, TenantContext } from '../../common/auth.types';
import { DevicesService } from './devices.service';
import { TapsService } from './taps.service';

@ApiTags('NFC-Stempel')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @Can('customers.read')
  list(@Tenant() ctx: TenantContext) {
    return this.devices.list(ctx);
  }

  @Post()
  @Can('devices.manage')
  @ApiZodBody(createDeviceSchema)
  create(@Tenant() ctx: TenantContext, @ZBody(createDeviceSchema) body: z.infer<typeof createDeviceSchema>) {
    return this.devices.create(ctx, body);
  }

  @Get(':id')
  @Can('devices.manage')
  get(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.devices.get(ctx, id);
  }

  @Patch(':id')
  @Can('devices.manage')
  @ApiZodBody(updateDeviceSchema)
  update(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(updateDeviceSchema) body: z.infer<typeof updateDeviceSchema>) {
    return this.devices.update(ctx, id, body);
  }

  @Put(':id/status')
  @Can('devices.manage')
  @ApiOperation({ summary: 'Aktivieren, deaktivieren, als verloren melden oder außer Betrieb nehmen' })
  setStatus(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(deviceStatusSchema) body: z.infer<typeof deviceStatusSchema>) {
    return this.devices.setStatus(ctx, id, body);
  }

  @Post(':id/rotate-keys')
  @HttpCode(200)
  @Can('org.manage')
  rotate(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.devices.rotateKeys(ctx, id);
  }

  @Post(':id/personalization')
  @HttpCode(200)
  @Can('org.manage')
  @ApiOperation({ summary: 'Schlüssel und NDEF-Profil für die Chip-Personalisierung abrufen (wird protokolliert)' })
  personalization(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.devices.personalization(ctx, id);
  }

  @Post(':id/simulate-tap')
  @HttpCode(200)
  @Can('stamps.grant')
  @ApiOperation({ summary: 'SIMULATION: nächste Tap-URL eines simulierten Stempels erzeugen' })
  simulate(@Tenant() ctx: TenantContext, @Param('id') id: string) {
    return this.devices.simulateTap(ctx, id);
  }
}

@ApiTags('Taps')
@Controller('taps')
export class TapsController {
  constructor(private readonly taps: TapsService) {}

  @Get('pending')
  @Can('stamps.grant')
  pending(@Tenant() ctx: TenantContext) {
    return this.taps.pending(ctx);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @Can('stamps.grant')
  decide(@Tenant() ctx: TenantContext, @Param('id') id: string, @ZBody(tapDecisionSchema) body: z.infer<typeof tapDecisionSchema>) {
    return this.taps.decide(ctx, id, body.decision);
  }
}

@ApiTags('Kassen-Schnittstelle')
@Controller('integrations/pos')
export class PosController {
  constructor(private readonly taps: TapsService) {}

  @Post('events')
  @HttpCode(200)
  @ApiKeyAuth('pos:write')
  @ApiOperation({ summary: 'Kassen-Ereignis melden (idempotent über externalId)' })
  @ApiZodBody(posEventSchema)
  event(@ApiKeyCtx() key: ApiKeyContext, @ZBody(posEventSchema) body: z.infer<typeof posEventSchema>) {
    return this.taps.ingestPosEvent(key.organizationId, body);
  }
}
