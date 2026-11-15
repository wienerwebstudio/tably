import Link from 'next/link';
import { buttonClass, Logo } from '@tapperl/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div>
        <p className="font-display text-6xl tracking-tight text-brand">404</p>
        <h1 className="mt-3 text-xl font-semibold">Diese Seite gibt es nicht</h1>
        <p className="mt-2 text-muted">Vielleicht ist der Link veraltet oder es hat sich ein Tippfehler eingeschlichen.</p>
      </div>
      <Link href="/" className={buttonClass({})}>Zur Startseite</Link>
    </main>
  );
}
