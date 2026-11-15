import { Controller, Get, HttpCode, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { SESSION_COOKIE } from '@tapperl/config';
import {
  acceptInvitationSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  totpCodeSchema,
  updateProfileSchema,
} from '@tapperl/types';
import { ApiZodBody, ZBody } from '../../common/zod';
import { Authenticated, CurrentAuth } from '../../common/guards';
import { clientIp, userAgent, type AppRequest, type AuthContext } from '../../common/auth.types';
import { SessionService } from '../../common/session.service';
import { PrismaService } from '../../common/prisma.service';
import { AppError } from '../../common/errors';
import { AuthService } from './auth.service';

const meta = (req: AppRequest) => ({ ip: clientIp(req), userAgent: userAgent(req) });
const strict = { default: { limit: 10, ttl: 60_000 } };
const switchSchema = z.object({ organizationId: z.string().min(1).max(40) });

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @Throttle(strict)
  @ApiOperation({ summary: 'Konto und Organisation anlegen, Testphase starten' })
  @ApiZodBody(registerSchema)
  register(@ZBody(registerSchema) body: z.infer<typeof registerSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    return this.auth.register(body, meta(req), res);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(strict)
  @ApiZodBody(loginSchema)
  login(@ZBody(loginSchema) body: z.infer<typeof loginSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(body.email, body.password, meta(req), res);
  }

  @Post('mfa')
  @HttpCode(200)
  @Throttle(strict)
  @ApiOperation({ summary: 'Zweiten Faktor (TOTP) nach dem Login bestätigen' })
  async mfa(@ZBody(totpCodeSchema) body: z.infer<typeof totpCodeSchema>, @Req() req: AppRequest) {
    await this.auth.completeMfa(req.cookies?.[SESSION_COOKIE], body.code);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const auth = await this.sessions.resolve(req.cookies?.[SESSION_COOKIE], true);
    if (auth) await this.sessions.revoke(auth.sessionId);
    this.sessions.clearCookie(res);
    return { ok: true };
  }

  @Get('me')
  @Authenticated()
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.me(auth);
  }

  @Patch('me')
  @Authenticated()
  async updateProfile(@CurrentAuth() auth: AuthContext, @ZBody(updateProfileSchema) body: z.infer<typeof updateProfileSchema>) {
    await this.prisma.user.update({ where: { id: auth.user.id }, data: { name: body.name } });
    return { ok: true };
  }

  @Post('switch-organization')
  @HttpCode(200)
  @Authenticated()
  async switchOrg(@CurrentAuth() auth: AuthContext, @ZBody(switchSchema) body: z.infer<typeof switchSchema>) {
    await this.auth.switchOrganization(auth, body.organizationId);
    return { ok: true };
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle(strict)
  async verifyEmail(@ZBody(tokenSchema) body: z.infer<typeof tokenSchema>) {
    await this.auth.verifyEmail(body.token);
    return { ok: true };
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Authenticated()
  async resend(@CurrentAuth() auth: AuthContext) {
    if (auth.user.emailVerified) throw new AppError('conflict', 'Deine E-Mail-Adresse ist bereits bestätigt.');
    await this.auth.sendVerification(auth.user.id, auth.user.email, auth.user.name);
    return { ok: true };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  async forgot(@ZBody(forgotPasswordSchema) body: z.infer<typeof forgotPasswordSchema>) {
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(strict)
  async reset(@ZBody(resetPasswordSchema) body: z.infer<typeof resetPasswordSchema>) {
    await this.auth.resetPassword(body.token, body.password);
    return { ok: true };
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle(strict)
  @Authenticated()
  async changePassword(@CurrentAuth() auth: AuthContext, @ZBody(changePasswordSchema) body: z.infer<typeof changePasswordSchema>) {
    await this.auth.changePassword(auth, body.currentPassword, body.newPassword);
    return { ok: true };
  }

  @Post('2fa/setup')
  @Authenticated()
  setupTotp(@CurrentAuth() auth: AuthContext) {
    return this.auth.setupTotp(auth);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @Throttle(strict)
  @Authenticated()
  async enableTotp(@CurrentAuth() auth: AuthContext, @ZBody(totpCodeSchema) body: z.infer<typeof totpCodeSchema>) {
    await this.auth.enableTotp(auth, body.code);
    return { ok: true };
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @Throttle(strict)
  @Authenticated()
  async disableTotp(@CurrentAuth() auth: AuthContext, @ZBody(totpCodeSchema) body: z.infer<typeof totpCodeSchema>) {
    await this.auth.disableTotp(auth, body.code);
    return { ok: true };
  }

  @Get('sessions')
  @Authenticated()
  async listSessions(@CurrentAuth() auth: AuthContext) {
    const sessions = await this.prisma.session.findMany({
      where: { userId: auth.user.id, revokedAt: null, expiresAt: { gt: new Date() }, mfaPending: false },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true },
    });
    return sessions.map((s) => ({ ...s, current: s.id === auth.sessionId }));
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  @Authenticated()
  async revokeOthers(@CurrentAuth() auth: AuthContext) {
    await this.sessions.revokeAllForUser(auth.user.id, auth.sessionId);
    return { ok: true };
  }

  @Get('invitations/:token')
  @Throttle(strict)
  invitationInfo(@Param('token') token: string) {
    return this.auth.invitationInfo(token);
  }

  @Post('invitations/accept')
  @HttpCode(200)
  @Throttle(strict)
  accept(@ZBody(acceptInvitationSchema) body: z.infer<typeof acceptInvitationSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    return this.auth.acceptInvitation(body, meta(req), res);
  }
}
