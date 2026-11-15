import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { PrismaService } from './common/prisma.service';
import { getEnv } from './common/env';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { OrganizationsController } from './modules/organizations/organizations.controller';
import { OrganizationsService } from './modules/organizations/organizations.service';
import { ProgramsController } from './modules/programs/programs.controller';
import { ProgramsService } from './modules/programs/programs.service';
import { CardsService } from './modules/cards/cards.service';
import { CustomersController } from './modules/customers/customers.controller';
import { CustomersService } from './modules/customers/customers.service';
import { LedgerService } from './modules/ledger/ledger.service';
import { StampsController } from './modules/stamps/stamps.controller';
import { DevicesController, PosController, TapsController } from './modules/nfc/nfc.controller';
import { ActiveReaderController } from './modules/nfc/active-reader.controller';
import { DevicesService } from './modules/nfc/devices.service';
import { TapsService } from './modules/nfc/taps.service';
import { PublicController } from './modules/public/public.controller';
import { PublicService } from './modules/public/public.service';
import { WalletController } from './modules/wallet/wallet.controller';
import { WalletService } from './modules/wallet/wallet.service';
import { BillingController } from './modules/billing/billing.controller';
import { BillingService } from './modules/billing/billing.service';
import { CampaignsController } from './modules/campaigns/campaigns.controller';
import { CampaignsService } from './modules/campaigns/campaigns.service';
import { AnalyticsController } from './modules/analytics/analytics.controller';
import { AnalyticsService } from './modules/analytics/analytics.service';
import { AdminController } from './modules/admin/admin.controller';

@ApiTags('System')
@Controller()
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', time: new Date().toISOString() };
  }
}

// In Tests ist die Begrenzung abgeschaltet; ein eigener Test aktiviert sie gezielt (TEST_RATE_LIMITS=true).
const skipThrottle = () => getEnv().NODE_ENV === 'test' && process.env.TEST_RATE_LIMITS !== 'true';

/**
 * Modularer Monolith: ein Prozess, klar getrennte Fachmodule unter src/modules.
 * Die Module teilen sich Infrastruktur (CommonModule) und rufen sich über
 * Services auf – keine Netzwerkgrenzen, aber eindeutige Zuständigkeiten.
 */
@Module({
  imports: [
    CommonModule,
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      skipIf: skipThrottle,
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    OrganizationsController,
    ProgramsController,
    CustomersController,
    StampsController,
    DevicesController,
    TapsController,
    PosController,
    ActiveReaderController,
    PublicController,
    WalletController,
    BillingController,
    CampaignsController,
    AnalyticsController,
    AdminController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    AuthService,
    OrganizationsService,
    ProgramsService,
    CardsService,
    CustomersService,
    LedgerService,
    DevicesService,
    TapsService,
    PublicService,
    WalletService,
    BillingService,
    CampaignsService,
    AnalyticsService,
  ],
})
export class AppModule {}
