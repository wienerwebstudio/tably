import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Ruhiger Rahmen für alle Kundenseiten: schmal, schnell, ohne Ablenkung. */
export default function CardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6 pt-6">
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="mt-10 text-center text-xs text-subtle">
        Treuekarte bereitgestellt von{' '}
        <Link href="/" className="font-medium hover:text-ink">Tably</Link> ·{' '}
        <Link href="/datenschutz" className="hover:text-ink">Datenschutz</Link> ·{' '}
        <Link href="/karten" className="hover:text-ink">Meine Karten</Link>
      </footer>
    </div>
  );
}
