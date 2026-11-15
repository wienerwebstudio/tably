import * as React from 'react';
import { Alert, cn } from '@tably/ui';
import { Container } from './ui';

/** Deutlich markierter Platzhalter für Angaben, die der Betreiber ergänzen muss. */
export function Todo({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-warn-soft px-1.5 py-0.5 font-medium text-warn [box-decoration-break:clone]">[Bitte ergänzen: {children}]</mark>;
}

export function LegalPage({ title, intro, updated, children }: { title: string; intro?: React.ReactNode; updated?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Container className="py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-[2.5rem] leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">{title}</h1>
        {intro ? <p className="mt-5 text-lg leading-relaxed text-muted">{intro}</p> : null}
        <Alert tone="warn" title="Entwurf – vor Veröffentlichung rechtlich prüfen und vervollständigen" className="mt-8">
          Dieser Text ist ein Gerüst und keine Rechtsberatung. Alle gelb markierten Stellen sind Platzhalter und müssen vom Betreiber ergänzt werden. {updated}
        </Alert>
        <div className="mt-12 space-y-12">{children}</div>
      </div>
    </Container>
  );
}

export function LegalSection({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl leading-snug text-ink">{title}</h2>
      <div className={cn('mt-4 space-y-4 text-[16px] leading-relaxed text-muted', '[&_h3]:mt-7 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-ink', '[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5', '[&_strong]:font-semibold [&_strong]:text-ink', '[&_a]:font-medium [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4')}>{children}</div>
    </section>
  );
}

export function LegalAddress({ children }: { children: React.ReactNode }) {
  return <address className="rounded-2xl border border-line bg-surface p-5 not-italic leading-loose text-ink">{children}</address>;
}
