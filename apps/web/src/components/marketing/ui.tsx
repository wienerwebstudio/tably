import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { buttonClass, cn } from '@tably/ui';
import { REGISTER_URL } from './site';

export function Container({ className, children, wide }: { className?: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-5 sm:px-8', wide ? 'max-w-7xl' : 'max-w-6xl', className)}>{children}</div>;
}

export function Section({ id, className, children, tone = 'paper' }: { id?: string; className?: string; children: React.ReactNode; tone?: 'paper' | 'surface' | 'sunken' }) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-20 py-20 sm:py-28', tone === 'surface' && 'border-y border-line bg-surface', tone === 'sunken' && 'bg-sunken', className)}
    >
      {children}
    </section>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-brand', className)}>
      <span className="h-px w-6 bg-honey" aria-hidden />
      {children}
    </p>
  );
}

export function SectionHeading({ eyebrow, title, lead, className, as: Tag = 'h2', center }: { eyebrow?: string; title: React.ReactNode; lead?: React.ReactNode; className?: string; as?: 'h1' | 'h2'; center?: boolean }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center', className)}>
      {eyebrow ? <Eyebrow className={center ? 'justify-center' : undefined}>{eyebrow}</Eyebrow> : null}
      <Tag className={cn('font-display text-[2rem] leading-[1.12] tracking-[-0.015em] text-ink text-balance sm:text-[2.75rem]', eyebrow && 'mt-4')}>{title}</Tag>
      {lead ? <p className="mt-5 text-lg leading-relaxed text-muted text-pretty">{lead}</p> : null}
    </div>
  );
}

/** Kopfbereich der Unterseiten. */
export function PageHero({ eyebrow, title, lead, children, aside }: { eyebrow: string; title: React.ReactNode; lead: React.ReactNode; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="border-b border-line">
      <Container className={cn('py-16 sm:py-24', aside && 'grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]')}>
        <div className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 font-display text-[2.5rem] leading-[1.06] tracking-[-0.02em] text-ink text-balance sm:text-6xl">{title}</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted text-pretty sm:text-xl">{lead}</p>
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
        {aside}
      </Container>
    </div>
  );
}

export function PrimaryCta({ className, label = 'Kostenlos testen' }: { className?: string; label?: string }) {
  return (
    <a href={REGISTER_URL} className={buttonClass({ size: 'lg', className: cn('rounded-xl', className) })}>
      {label}
      <ArrowRight className="size-4" aria-hidden />
    </a>
  );
}

export function SecondaryCta({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={buttonClass({ variant: 'outline', size: 'lg', className: cn('rounded-xl', className) })}>
      {children}
    </Link>
  );
}

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-1.5 font-medium text-brand underline-offset-4 hover:underline', className)}>
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function CheckList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink">
          <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
            <Check className="size-3" strokeWidth={3} />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Abschluss jeder Seite. */
export function ClosingCta({ title = 'Probier es an deiner Theke aus.', text }: { title?: string; text?: string }) {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-brand px-6 py-14 text-center sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -left-24 -top-32 size-96 rounded-full bg-white/[0.04]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -right-20 size-[30rem] rounded-full bg-white/[0.04]" aria-hidden />
        <div className="relative mx-auto max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/70">Tap. Stamp. Reward.</p>
          <h2 className="mt-4 font-display text-[2rem] leading-[1.12] tracking-[-0.015em] text-white text-balance sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/75 text-pretty">
            {text ?? 'Konto anlegen, Karte gestalten und mit dem simulierten Stempel im Dashboard testen – 14 Tage kostenlos. Den echten Stempel kannst du über das Kontaktformular vorbestellen.'}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={REGISTER_URL} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 font-medium text-[#1f3a2e] transition-colors hover:bg-white/90 focus-visible:outline-white sm:w-auto">
              Kostenlos testen
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <Link href="/kontakt?thema=hardware" className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/30 px-6 font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-white sm:w-auto">
              Stempel vorbestellen
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
