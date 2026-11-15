'use client';
import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { mutate } from 'swr';
import { Alert, api, ApiError, buttonClass, Spinner } from '@tapperl/ui';

function Verify() {
  const token = useSearchParams().get('token');
  const [state, setState] = React.useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = React.useState('');
  const started = React.useRef(false);
  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState('error');
      setMessage('Der Link ist unvollständig.');
      return;
    }
    api('/auth/verify-email', { body: { token } })
      .then(() => (setState('done'), void mutate('/auth/me')))
      .catch((err) => (setState('error'), setMessage(err instanceof ApiError ? err.message : 'Die Bestätigung ist fehlgeschlagen.')));
  }, [token]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">E-Mail-Adresse bestätigen</h1>
      {state === 'working' ? <div className="flex items-center gap-3 text-sm text-muted"><Spinner /> Einen Moment …</div> : null}
      {state === 'done' ? <Alert tone="success" title="Bestätigt">Deine E-Mail-Adresse ist bestätigt. Du kannst jetzt Karten veröffentlichen und Kampagnen starten.</Alert> : null}
      {state === 'error' ? <Alert tone="danger" title="Nicht bestätigt">{message} Im Dashboard kannst du dir einen neuen Link schicken lassen.</Alert> : null}
      {state !== 'working' ? <Link href="/" className={buttonClass({ size: 'lg' })}>Zum Dashboard</Link> : null}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense>
      <Verify />
    </React.Suspense>
  );
}
