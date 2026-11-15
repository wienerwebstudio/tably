'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, ChevronsUpDown, CreditCard, History, LayoutDashboard, LogOut, Megaphone, Menu as MenuIcon, Moon, Nfc, Settings, ShieldCheck, Store, Sun, Users, X } from 'lucide-react';
import type { Permission } from '@tably/types';
import { Alert, api, Badge, Button, cn, Logo, Menu, MenuItem, MenuLabel, MenuSeparator, useToast } from '@tably/ui';
import { useSession } from '@/lib/session';
import { roleLabel } from '@/lib/labels';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { href: '/', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/theke', label: 'Theke', icon: Store, permission: 'stamps.grant' },
  { href: '/kunden', label: 'Kunden', icon: Users, permission: 'customers.read' },
  { href: '/karten', label: 'Treuekarten', icon: CreditCard },
  { href: '/stempel', label: 'NFC-Stempel', icon: Nfc, permission: 'devices.manage' },
  { href: '/buchungen', label: 'Buchungen', icon: History, permission: 'customers.read' },
  { href: '/marketing', label: 'Marketing', icon: Megaphone, permission: 'campaigns.manage' },
  { href: '/analysen', label: 'Analysen', icon: BarChart3, permission: 'analytics.read' },
  { href: '/einstellungen', label: 'Einstellungen', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useSession();
  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-0.5">
      {NAV.filter((item) => !item.permission || can(item.permission)).map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors', active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-sunken hover:text-ink')}
          >
            <item.icon className="size-[18px] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeToggleItem() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  return (
    <MenuItem
      onSelect={() => {
        const next = !dark;
        document.documentElement.classList.toggle('dark', next);
        try {
          localStorage.setItem('tably-theme', next ? 'dark' : 'light');
        } catch {
          /* Speicher nicht verfügbar */
        }
        setDark(next);
      }}
    >
      {dark ? <Sun /> : <Moon />}
      {dark ? 'Helles Design' : 'Dunkles Design'}
    </MenuItem>
  );
}

function UserMenu() {
  const { me, refresh } = useSession();
  const router = useRouter();
  const toast = useToast();
  const switchOrg = async (organizationId: string) => {
    try {
      await api('/auth/switch-organization', { body: { organizationId } });
      await refresh();
      router.replace('/');
      router.refresh();
    } catch {
      toast.error('Der Wechsel hat nicht geklappt.');
    }
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/login';
  };
  return (
    <Menu
      align="start"
      trigger={
        <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-2.5 text-left hover:bg-sunken">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-on-brand" aria-hidden>
            {me.user.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{me.user.name}</span>
            <span className="block truncate text-xs text-muted">{me.role ? roleLabel[me.role] : me.user.email}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
        </button>
      }
    >
      <MenuLabel>{me.user.email}</MenuLabel>
      {me.memberships.length > 1 ? (
        <>
          <MenuSeparator />
          <MenuLabel>Betrieb wechseln</MenuLabel>
          {me.memberships.map((m) => (
            <MenuItem key={m.organizationId} onSelect={() => void switchOrg(m.organizationId)} disabled={m.organizationId === me.organization?.id}>
              <Store />
              <span className="truncate">{m.name}</span>
            </MenuItem>
          ))}
        </>
      ) : null}
      <MenuSeparator />
      <MenuItem onSelect={() => router.push('/einstellungen?tab=sicherheit')}>
        <ShieldCheck />
        Konto & Sicherheit
      </MenuItem>
      <ThemeToggleItem />
      {me.user.isSuperAdmin ? (
        <MenuItem onSelect={() => router.push('/admin')}>
          <ShieldCheck />
          Plattformverwaltung
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem onSelect={() => void logout()}>
        <LogOut />
        Abmelden
      </MenuItem>
    </Menu>
  );
}

function Banners() {
  const { me, can } = useSession();
  const toast = useToast();
  const [resending, setResending] = React.useState(false);
  const sub = me.subscription;
  const banners: React.ReactNode[] = [];

  if (me.organization?.status === 'SUSPENDED') {
    banners.push(<Alert key="suspended" tone="danger" title="Dieses Konto wurde gesperrt">Änderungen sind derzeit nicht möglich. Bitte wende dich an den Support.</Alert>);
  }
  if (sub && !sub.writable) {
    banners.push(
      <Alert
        key="restricted"
        tone="danger"
        title={sub.status === 'CANCELED' ? 'Dein Abonnement ist beendet' : 'Dein Konto ist eingeschränkt'}
        action={can('billing.manage') ? <Link href="/einstellungen?tab=abo" className="whitespace-nowrap text-sm font-semibold text-danger underline">Tarif wählen</Link> : undefined}
      >
        Deine Daten bleiben erhalten und Kundenkarten bleiben sichtbar. Stempel, Anmeldungen und Änderungen ruhen, bis ein Tarif aktiv ist.
      </Alert>,
    );
  } else if (sub?.status === 'PAST_DUE') {
    banners.push(
      <Alert key="pastdue" tone="warn" title="Die letzte Zahlung ist fehlgeschlagen" action={can('billing.manage') ? <Link href="/einstellungen?tab=abo" className="whitespace-nowrap text-sm font-semibold underline">Zur Abrechnung</Link> : undefined}>
        Bitte aktualisiere deine Zahlungsdaten, sonst wird das Konto nach einigen Tagen eingeschränkt.
      </Alert>,
    );
  } else if (sub?.status === 'TRIALING' && sub.trialEndsAt) {
    const days = Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000));
    if (days <= 5) {
      banners.push(
        <Alert key="trial" tone="info" title={days === 0 ? 'Deine Testphase endet heute' : `Deine Testphase endet in ${days} ${days === 1 ? 'Tag' : 'Tagen'}`} action={can('billing.manage') ? <Link href="/einstellungen?tab=abo" className="whitespace-nowrap text-sm font-semibold underline">Tarif wählen</Link> : undefined}>
          Wähle rechtzeitig einen Tarif, damit dein Treueprogramm ohne Unterbrechung weiterläuft.
        </Alert>,
      );
    }
  }
  if (!me.user.emailVerified) {
    banners.push(
      <Alert
        key="verify"
        tone="warn"
        title="Bitte bestätige deine E-Mail-Adresse"
        action={
          <Button
            size="sm"
            variant="outline"
            loading={resending}
            onClick={async () => {
              setResending(true);
              try {
                await api('/auth/resend-verification', { method: 'POST' });
                toast.success('Wir haben dir einen neuen Link geschickt.');
              } catch {
                toast.error('Der Versand hat nicht geklappt. Bitte später erneut versuchen.');
              } finally {
                setResending(false);
              }
            }}
          >
            Link erneut senden
          </Button>
        }
      >
        Wir haben einen Link an {me.user.email} geschickt. Erst danach kannst du Karten veröffentlichen und Kampagnen starten.
      </Alert>,
    );
  }
  if (banners.length === 0) return null;
  return <div className="mb-6 flex flex-col gap-3">{banners}</div>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setOpen(false), [pathname]);
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => void (document.body.style.overflow = '');
  }, [open]);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between px-2 pt-1">
        <Link href="/" aria-label="Zur Übersicht">
          <Logo />
        </Link>
        <button type="button" className="rounded-lg p-2 text-muted hover:bg-sunken lg:hidden" onClick={() => setOpen(false)} aria-label="Navigation schließen">
          <X className="size-5" />
        </button>
      </div>
      <div className="px-2">
        <p className="truncate text-sm font-semibold text-ink">{me.organization?.name}</p>
        {me.subscription ? (
          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
            Tarif {me.subscription.planName}
            {me.subscription.status === 'TRIALING' ? <Badge tone="info">Test</Badge> : null}
          </p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks onNavigate={() => setOpen(false)} />
      </div>
      <UserMenu />
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#inhalt" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand">
        Zum Inhalt springen
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-raised">{sidebar}</aside>
        </div>
      ) : null}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
        <button type="button" className="rounded-lg p-2 text-ink hover:bg-sunken" onClick={() => setOpen(true)} aria-label="Navigation öffnen" aria-expanded={open}>
          <MenuIcon className="size-5" />
        </button>
        <Logo />
      </header>
      <main id="inhalt" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <Banners />
        {children}
      </main>
    </div>
  );
}
