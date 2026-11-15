'use client';
import * as React from 'react';
import type { WalletStatusDto } from '@tapperl/types';
import { Alert, defineCopy, useCopy } from '@tapperl/ui';
import { walletConfigured } from './labels';

const copy = defineCopy({
  de: {
    title: 'So wird aktuell versendet',
    mailLocalTitle: 'Testmodus',
    mailLocal: 'Testmodus – E-Mails werden nicht wirklich versendet, sondern nur protokolliert.',
    mailSmtp: 'E-Mails werden echt an deine Kunden versendet.',
    mailNoFeature: 'E-Mail-Kampagnen sind in deinem Tarif nicht enthalten.',
    walletBoth: 'Wallet-Mitteilungen sind möglich: Apple Wallet und Google Wallet sind eingerichtet.',
    walletApple: 'Wallet-Mitteilungen sind nur für Apple Wallet möglich. Google Wallet ist nicht eingerichtet.',
    walletGoogle: 'Wallet-Mitteilungen sind nur für Google Wallet möglich. Apple Wallet ist nicht eingerichtet.',
    walletNone: 'Wallet-Mitteilungen sind derzeit nicht möglich: Weder Apple Wallet noch Google Wallet ist auf diesem System eingerichtet. Empfänger über diesen Kanal werden übersprungen.',
    walletUnknown: 'Der Status der Wallet-Anbindung konnte nicht geladen werden.',
    card: 'Hinweise auf der Webkarte funktionieren immer.',
  },
});

/**
 * Zeigt ehrlich, was beim Versand wirklich passiert. `mailMode` ist nur
 * bekannt, wenn bereits eine Kampagne geladen wurde.
 */
export function DeliveryBanner({ mailMode, wallet, walletError, emailFeature, className }: { mailMode?: 'smtp' | 'local'; wallet: WalletStatusDto | undefined; walletError?: boolean; emailFeature: boolean; className?: string }) {
  const t = useCopy(copy);
  if (!wallet && !walletError && !mailMode) return null;
  const local = mailMode === 'local' && emailFeature;
  const walletText = walletError ? t.walletUnknown : !wallet ? null : wallet.apple.configured && wallet.google.configured ? t.walletBoth : wallet.apple.configured ? t.walletApple : wallet.google.configured ? t.walletGoogle : t.walletNone;
  const limited = local || !walletConfigured(wallet);
  return (
    <Alert tone={limited ? 'warn' : 'info'} title={local ? t.mailLocalTitle : t.title} className={className}>
      <ul className="space-y-1">
        {!emailFeature ? <li>{t.mailNoFeature}</li> : mailMode === 'local' ? <li>{t.mailLocal}</li> : mailMode === 'smtp' ? <li>{t.mailSmtp}</li> : null}
        {walletText ? <li>{walletText}</li> : null}
        <li>{t.card}</li>
      </ul>
    </Alert>
  );
}
