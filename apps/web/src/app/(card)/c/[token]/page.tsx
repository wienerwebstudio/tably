'use client';
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ErrorState, Spinner } from '@tably/ui';

/** Link aus dem Wallet-Pass: öffnet die Karte auf diesem Gerät. */
export default function AccessPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [failed, setFailed] = React.useState(false);
  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    api<{ cardId: string }>('/public/access', { body: { token } })
      .then((res) => router.replace(`/karte/${res.cardId}`))
      .catch(() => setFailed(true));
  }, [token, router]);
  if (failed) return <ErrorState title="Dieser Link ist ungültig" description="Bitte öffne die Karte über den Link in deiner Wallet-Karte oder im Geschäft." />;
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner label="Karte wird geöffnet …" />
    </div>
  );
}
