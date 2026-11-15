import Link from 'next/link';
import { Logo, LoyaltyCard } from '@tably/ui';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href={WEB_URL} aria-label="Zur Tably-Website">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
        <p className="text-xs text-subtle">
          <a className="hover:text-ink" href={`${WEB_URL}/impressum`}>Impressum</a> · <a className="hover:text-ink" href={`${WEB_URL}/datenschutz`}>Datenschutz</a>
        </p>
      </div>
      <aside className="relative hidden items-center justify-center overflow-hidden bg-brand p-12 lg:flex" aria-hidden>
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 size-[28rem] rounded-full bg-white/5" />
        <div className="relative w-full max-w-sm">
          <LoyaltyCard
            className="-rotate-3"
            data={{ organizationName: 'Café Morgenrot', cardTitle: 'Kaffeekarte', stampsRequired: 10, balance: 7, stampIcon: 'coffee', rewardName: 'Gratis Kaffee', backgroundColor: '#F6F1E7', textColor: '#1F3A2E', accentColor: '#C98A2B' }}
          />
          <p className="mt-12 font-display text-3xl leading-tight text-white">Tap. Stamp. Reward.</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">Digitale Treuekarten, die an der Theke so schnell sind wie ein Stempel auf Papier.</p>
        </div>
      </aside>
    </div>
  );
}
