'use client';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ErrorState, Logo, Spinner } from '@tapperl/ui';
import { SessionProvider, useMe } from '@/lib/session';
import { Shell } from '@/components/shell';

/** Geschützter Bereich: lädt die Sitzung und leitet Unangemeldete zur Anmeldung. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, status, refresh } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/login${pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : ''}`);
  }, [status, router, pathname]);

  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState title="Tapperl ist gerade nicht erreichbar" description="Bitte prüfe deine Verbindung und versuche es erneut." onRetry={() => void refresh()} />
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
  if (!me.organization) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <ErrorState title="Kein Betrieb zugeordnet" description="Dein Konto gehört derzeit zu keinem Betrieb. Bitte lass dich erneut einladen." />
      </div>
    );
  }
  // Der Einrichtungsassistent hat ein eigenes, ruhiges Layout ohne Navigation.
  const bare = pathname.startsWith('/onboarding');
  return (
    <SessionProvider me={me} refresh={refresh}>
      {bare ? children : <Shell>{children}</Shell>}
    </SessionProvider>
  );
}
