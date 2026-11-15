import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { TRIAL_DAYS } from '@tably/config';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma.service';
import { AuthService } from './modules/auth/auth.service';
import { CardsService } from './modules/cards/cards.service';
import { encryptSecret, randomId } from './common/crypto';
import { getEnv } from './common/env';
import { addDays } from './common/util';

/**
 * Seed:
 *   node dist/seed.js          → Tarife + Super-Admin (aus SUPERADMIN_EMAIL/PASSWORD)
 *   node dist/seed.js --demo   → zusätzlich ein klar gekennzeichneter Demo-Betrieb
 *                                 mit Beispielkunden (nur für Entwicklung/Vorführung)
 */
async function main(): Promise<void> {
  const env = getEnv();
  const demo = process.argv.includes('--demo');
  if (demo && env.NODE_ENV === 'production') throw new Error('Demo-Daten werden in Produktion nicht angelegt.');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const auth = app.get(AuthService);
  const cards = app.get(CardsService);

  if (env.SUPERADMIN_EMAIL && env.SUPERADMIN_PASSWORD) {
    const email = env.SUPERADMIN_EMAIL.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({ where: { email }, data: { isSuperAdmin: true } });
      console.log(`Super-Admin vorhanden: ${email}`);
    } else {
      await prisma.user.create({ data: { email, name: 'Plattform-Admin', passwordHash: await auth.hashPassword(env.SUPERADMIN_PASSWORD), isSuperAdmin: true, emailVerifiedAt: new Date() } });
      console.log(`Super-Admin angelegt: ${email}`);
    }
  } else {
    console.log('SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD nicht gesetzt – kein Super-Admin angelegt.');
  }

  if (demo) {
    const email = 'demo@tably.local';
    const password = 'Demo-Passwort-123';
    if (await prisma.user.findUnique({ where: { email } })) {
      console.log('Demo-Betrieb existiert bereits.');
    } else {
      const user = await prisma.user.create({ data: { email, name: 'Dana Demo', passwordHash: await auth.hashPassword(password), emailVerifiedAt: new Date() } });
      const org = await prisma.organization.create({
        data: {
          name: 'Café Morgenrot (Demo)',
          slug: 'cafe-morgenrot-demo',
          industry: 'cafe',
          email,
          city: 'Wien',
          country: 'AT',
          timezone: 'Europe/Vienna',
          onboardingCompletedAt: new Date(),
          members: { create: { userId: user.id, role: 'OWNER' } },
          subscription: { create: { planId: 'business', status: 'TRIALING', trialEndsAt: addDays(new Date(), TRIAL_DAYS) } },
        },
      });
      const [main, second] = await Promise.all([
        prisma.location.create({ data: { organizationId: org.id, name: 'Neubaugasse', city: 'Wien' } }),
        prisma.location.create({ data: { organizationId: org.id, name: 'Naschmarkt', city: 'Wien' } }),
      ]);
      const program = await prisma.loyaltyProgram.create({
        data: {
          organizationId: org.id,
          name: 'Kaffeekarte',
          slug: 'kaffeekarte',
          cardTitle: 'Kaffeekarte',
          description: 'Jeder zehnte Kaffee geht aufs Haus.',
          stampsRequired: 10,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          design: { backgroundColor: '#1F3A2E', textColor: '#FFFFFF', accentColor: '#E8B86D', logoAssetId: null, showLogo: true, rewardText: '', footerText: 'Danke, dass du da bist!' },
          rewards: { create: { organizationId: org.id, name: 'Gratis Kaffee', description: 'Ein Heißgetränk deiner Wahl', cost: 10 } },
        },
      });
      const devices = await Promise.all(
        [main, second].map((location, i) =>
          prisma.nfcDevice.create({
            data: {
              organizationId: org.id,
              locationId: location.id,
              programId: program.id,
              publicId: randomId('st', 9),
              name: `Demo-Stempel ${i + 1} (simuliert)`,
              kind: 'SIMULATED',
              status: 'ACTIVE',
              activatedAt: new Date(),
              uidHex: `04${randomBytes(6).toString('hex').toUpperCase()}`,
              metaKeyEnc: encryptSecret(randomBytes(16)),
              fileKeyEnc: encryptSecret(randomBytes(16)),
            },
          }),
        ),
      );
      const names = ['Lena', 'Jonas', 'Mara', 'Felix', 'Sophie', 'Emil', 'Hanna', 'Noah', 'Ida', 'Paul', 'Clara', 'Theo', 'Greta', 'Luis', 'Nora', 'Max', 'Frieda', 'Anton', 'Elsa', 'Karl', 'Mia', 'Oskar', 'Lotte', 'Ben'];
      let seed = 42;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
      for (const [i, firstName] of names.entries()) {
        const createdAt = addDays(new Date(), -Math.floor(rnd() * 70) - 2);
        const customer = await prisma.customer.create({
          data: { organizationId: org.id, firstName, email: i % 3 === 0 ? null : `${firstName.toLowerCase()}@beispiel.test`, source: 'demo', createdAt },
        });
        await prisma.consentRecord.createMany({
          data: [
            { organizationId: org.id, customerId: customer.id, type: 'PRIVACY', granted: true, policyVersion: 'demo', source: 'demo', createdAt },
            { organizationId: org.id, customerId: customer.id, type: 'MARKETING_EMAIL', granted: i % 2 === 0 && i % 3 !== 0, policyVersion: 'demo', source: 'demo', createdAt },
          ],
        });
        const { card } = await prisma.$transaction((tx) => cards.createCard(tx, { organizationId: org.id, program, customerId: customer.id }));
        const visits = 1 + Math.floor(rnd() * 14);
        let balance = 0;
        let last: Date | null = null;
        let earned = 0;
        let redeemed = 0;
        const span = Date.now() - createdAt.getTime();
        for (let v = 0; v < visits; v++) {
          const at = new Date(createdAt.getTime() + (span * (v + rnd())) / visits);
          const device = devices[Math.floor(rnd() * devices.length)]!;
          balance += 1;
          earned += 1;
          last = at;
          const tx = await prisma.stampTransaction.create({
            data: { organizationId: org.id, programId: program.id, cardId: card.id, customerId: customer.id, deviceId: device.id, locationId: device.locationId, type: 'EARN', source: 'SIMULATED_TAP', amount: 1, idempotencyKey: `demo:${card.id}:${v}`, createdAt: at },
          });
          await prisma.pointLedger.create({ data: { organizationId: org.id, cardId: card.id, transactionId: tx.id, delta: 1, balanceAfter: balance, createdAt: at } });
          if (balance >= 10) {
            balance -= 10;
            redeemed += 10;
            const redeemAt = new Date(at.getTime() + 60_000);
            const rtx = await prisma.stampTransaction.create({
              data: { organizationId: org.id, programId: program.id, cardId: card.id, customerId: customer.id, locationId: device.locationId, staffUserId: user.id, type: 'REDEEM', source: 'MANUAL', amount: -10, idempotencyKey: `demo:${card.id}:r${v}`, note: 'Gratis Kaffee', createdAt: redeemAt },
            });
            await prisma.pointLedger.create({ data: { organizationId: org.id, cardId: card.id, transactionId: rtx.id, delta: -10, balanceAfter: balance, createdAt: redeemAt } });
          }
        }
        await prisma.loyaltyCard.update({ where: { id: card.id }, data: { balance, lifetimeEarned: earned, lifetimeRedeemed: redeemed, visits, lastStampAt: last, createdAt } });
        await prisma.customer.update({ where: { id: customer.id }, data: { lastActivityAt: last } });
      }
      console.log(`Demo-Betrieb angelegt. Anmeldung: ${email} / ${password}`);
    }
  }
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
