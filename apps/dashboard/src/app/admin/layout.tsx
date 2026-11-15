'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { api, buttonClass, cn, defineCopy, ErrorState, Logo, Spinner, useCopy } from '@tably/ui';
import { useMe } from '@/lib/session';

const copy = defineCopy({
  de: {
    title: 'Plattformverwaltung',
    nav: 'Plattformverwaltung',
    back: 'Zurück zum Dashboard',
    backShort: 'Dashboard',
    logout: 'Abmelden',
    skip: 'Zum Inhalt springen',
    unreachableTitle: 'Tably ist gerade nicht erreichbar',
    unreachableText: 'Bitte prüfe deine Verbindung und versuche es erneut.',
    notFoundTitle: 'Diese Seite gibt es nicht',
    notFoundText: 'Die Adresse ist falsch oder die Seite wurde verschoben.',
    notFoundBack: 'Zur Übersicht',
    items: {
      overview: 'Übersicht',
      organizations: 'Betriebe',
      users: 'Benutzer',
      hardware: 'Hardware',
      abuse: 'Missbrauch',
      plans: 'Tarife',
      errors: 'Fehler',
      requests: 'Anfragen',
      audit: 'Protokoll',
    },
  },
});

const NAV = [
  { href: '/admin', key: 'overview' },
  { href: '/admin/betriebe', key: 'organizations' },
  { href: '/admin/benutzer', key: 'users' },
  { href: '/admin/hardware', key: 'hardware' },
  { href: '/admin/missbrauch', key: 'abuse' },
  { href: '/admin/tarife', key: 'plans' },
  { href: '/admin/fehler', key: 'errors' },
  { href: '/admin/anfragen', key: 'requests' },
  { href: '/admin/protokoll', key: 'audit' },
] as const;

/** Gleiche Ansicht wie für unbekannte Adressen – der Bereich gibt sich Unbefugten nicht zu erkennen. */
function NotFoundView() {
  const t = useCopy(copy);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo />
      <p className="mt-4 text-5xl font-semibold tracking-tight text-ink tabular">404</p>
      <h1 className="text-lg font-semibold text-ink">{t.notFoundTitle}</h1>
      <p className="max-w-sm text-sm text-muted">{t.notFoundText}</p>
      <Link href="/" className={buttonClass({ variant: 'outline', className: 'mt-2' })}>{t.notFoundBack}</Link>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useCopy(copy);
  const { me, status, refresh } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/login?next=${encodeURIComponent(pathname.startsWith('/admin') ? pathname : '/admin')}`);
  }, [status, router, pathname]);

  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState title={t.unreachableTitle} description={t.unreachableText} onRetry={() => void refresh()} />
      </div>
    );
  }
  if (!me) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Logo />
        <Spinner />
      </div>
    );
  }
  if (!me.user.isSuperAdmin) return <NotFoundView />;

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/login';
  };
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`));
  const headerLink = 'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-paper/80 hover:bg-paper/10 hover:text-paper dark:text-muted dark:hover:bg-line dark:hover:text-ink';

  return (
    <div className="min-h-dvh">
      <a href="#inhalt" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand">
        {t.skip}
      </a>
      <header className="sticky top-0 z-20 bg-ink text-paper dark:border-b dark:border-line dark:bg-sunken dark:text-ink">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-8">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5" aria-label={t.title}>
            <Logo mark />
            <span className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold tracking-tight">
              <ShieldCheck className="size-4 shrink-0 text-honey" aria-hidden />
              <span className="truncate">{t.title}</span>
            </span>
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <span className="mr-2 hidden max-w-48 truncate text-xs text-paper/60 dark:text-subtle md:inline">{me.user.email}</span>
            {me.organization ? (
              <Link href="/" className={headerLink}>
                <ArrowLeft className="size-4" aria-hidden />
                <span className="hidden sm:inline">{t.back}</span>
                <span className="sm:hidden">{t.backShort}</span>
              </Link>
            ) : null}
            <button type="button" className={headerLink} onClick={() => void logout()} aria-label={t.logout}>
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          </div>
        </div>
        <nav aria-label={t.nav} className="mx-auto w-full max-w-7xl overflow-x-auto px-2 sm:px-6">
          <ul className="flex gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                      active ? 'border-honey text-paper dark:text-ink' : 'border-transparent text-paper/70 hover:text-paper dark:text-muted dark:hover:text-ink',
                    )}
                  >
                    {t.items[item.key]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="inhalt" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
