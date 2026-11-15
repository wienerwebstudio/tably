'use client';
import { Button, Logo } from '@tably/ui';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center" role="alert">
      <Logo />
      <div>
        <h1 className="text-xl font-semibold">Da ist etwas schiefgelaufen</h1>
        <p className="mt-2 text-muted">Bitte versuche es noch einmal. Wenn das Problem bleibt, lade die Seite neu.</p>
      </div>
      <Button onClick={reset}>Erneut versuchen</Button>
    </main>
  );
}
