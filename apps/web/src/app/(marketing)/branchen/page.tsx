import type { Metadata } from 'next';
import { cn, LoyaltyCard } from '@tably/ui';
import { Reveal } from '@/components/marketing/reveal';
import { INDUSTRIES } from '@/components/marketing/site';
import { CheckList, ClosingCta, Container, PageHero, PrimaryCta, SecondaryCta } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Branchen',
  description: 'Digitale Stempelkarten für Cafés, Bäckereien, Restaurants, Friseur- und Barbershops, Kosmetik- und Nagelstudios, Fitnessstudios, Blumenläden, Einzelhandel, Autowaschanlagen und Dienstleister – mit Beispielkarten.',
};

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Branchen"
        title="Eine Karte für jeden Laden, in den man gern zurückkommt."
        lead="Zwölf Beispiele, wie Betriebe im deutschsprachigen Raum Tably einsetzen können. Alle gezeigten Betriebe, Karten und Prämien sind frei erfunden – sie zeigen, was der Karten-Designer hergibt."
      >
        <nav aria-label="Branchen auf dieser Seite">
          <ul className="flex flex-wrap gap-2">
            {INDUSTRIES.map((i) => (
              <li key={i.id}>
                <a href={`#${i.id}`} className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand">
                  {i.short}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHero>

      <div>
        {INDUSTRIES.map((ind, i) => (
          <section key={ind.id} id={ind.id} className={cn('scroll-mt-20 border-b border-line py-16 sm:py-20', i % 2 === 1 && 'bg-surface')}>
            <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-20">
              <div className={cn(i % 2 === 1 && 'lg:order-2')}>
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand">{ind.label}</p>
                <h2 className="mt-3 font-display text-[1.9rem] leading-[1.14] tracking-[-0.015em] text-ink text-balance sm:text-4xl">{ind.headline}</h2>
                <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">{ind.text}</p>
                <h3 className="mt-8 text-[13px] font-semibold uppercase tracking-[0.12em] text-subtle">So könnte es aussehen</h3>
                <CheckList items={ind.ideas} className="mt-4" />
              </div>
              <Reveal className={cn('mx-auto w-full max-w-[400px]', i % 2 === 1 && 'lg:order-1')}>
                <LoyaltyCard data={ind.card} className={i % 2 === 0 ? 'rotate-2' : '-rotate-2'} />
                <p className="mt-6 text-center text-xs text-subtle">Beispielkarte · fiktiver Betrieb</p>
              </Reveal>
            </Container>
          </section>
        ))}
      </div>

      <Container className="py-16 text-center sm:py-20">
        <h2 className="font-display text-3xl text-ink sm:text-4xl">Deine Branche ist nicht dabei?</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">Tably funktioniert überall, wo wiederkehrende Besuche belohnt werden sollen. Schreib uns, was du vorhast.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <PrimaryCta />
          <SecondaryCta href="/kontakt">Kontakt aufnehmen</SecondaryCta>
        </div>
      </Container>
      <ClosingCta />
    </>
  );
}
