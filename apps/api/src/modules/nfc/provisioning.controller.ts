import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { AppRequest } from '../../common/auth.types';
import { ApiZodBody, ZBody } from '../../common/zod';
import { ProvisioningService } from './provisioning.service';

const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });
const completeSchema = codeSchema.extend({
  e: z.string().regex(/^[0-9A-Fa-f]{32}$/),
  c: z.string().regex(/^[0-9A-Fa-f]{16}$/),
});

/**
 * Öffentliche Schnittstelle der Tapperl-Einrichtungs-App. Berechtigung über den
 * kurzlebigen Einmal-Code aus dem Dashboard (kein Cookie, daher CSRF-frei).
 */
@ApiTags('Stempel-Einrichtung (App)')
@Controller('devices/v1/provisioning')
export class ProvisioningController {
  constructor(private readonly provisioning: ProvisioningService) {}

  @Post('fetch')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @ApiZodBody(codeSchema)
  @ApiOperation({ summary: 'Schlüssel und NDEF-Profil für einen Einrichtungscode abholen' })
  fetch(@Req() req: AppRequest, @ZBody(codeSchema) body: z.infer<typeof codeSchema>) {
    return this.provisioning.fetch(body.code, req.ip ?? null);
  }

  @Post('complete')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  @ApiZodBody(completeSchema)
  @ApiOperation({ summary: 'Erste SUN-Signatur des eingerichteten Chips melden und Stempel aktivieren' })
  complete(@Req() req: AppRequest, @ZBody(completeSchema) body: z.infer<typeof completeSchema>) {
    return this.provisioning.complete(body.code, { e: body.e, c: body.c }, req.ip ?? null);
  }
}
