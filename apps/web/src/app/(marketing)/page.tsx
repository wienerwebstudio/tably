import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Fingerprint, KeyRound, Server, UserCheck } from 'lucide-react';
import { formatMoney, LoyaltyCard } from '@tably/ui';
import { CardConfigurator } from '@/components/marketing/card-configurator';
import { FaqList, pickFaq } from '@/components/marketing/faq';
import { HeroDemo } from '@/components/marketing/hero-demo';
import { AnalyticsMock, CampaignMock, DesignerMock, TapCheckMock, TapFeedMock } from '@/components/marketing/mocks';
import { getPlans } from '@/components/marketing/plans';
import { Reveal } from '@/components/marketing/reveal';
import { INDUSTRIES } from '@/components/marketing/site';
import { ClosingCta, Container, Eyebrow, PrimaryCta, SecondaryCta, Section, SectionHeading, TextLink } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: { absolute: 'Tably – Digitale Treuekarten mit NFC-Stempel' },
  description: 'Tap. Stamp. Reward. Tably ersetzt die Papier-Stempelkarte: Dein Team hält einen echten Stempel ans Smartphone, die digitale Karte zählt mit. Ohne App für deine Gäste, ohne Scanner an der Theke.',
};

const STEPS = [
  {
    title: 'Karte gestalten',
    text: 'Farben, Symbol, Stempelzahl und Prämie festlegen. Die Karte ist veröffentlicht, sobald du es sagst.',
  },
  {
    title: 'Stempel ans Handy halten',
    text: 'Dein Team hält den Stempel kurz an die Rückseite des Smartphones – so selbstverständlich wie früher aufs Papier.',
  },
  {
    title: 'Mitteilung antippen',
    text: 'Auf dem iPhone erscheint eine Mitteilung, die dein Gast einmal antippt. Die Karte öffnet sich im Browser, ohne App.',
  },
  {
    title: 'Stempel sammeln, Prämie einlösen',
    text: 'Beim ersten Mal genügt der Vorname. Ist die Karte voll, zeigt dein Gast den Einlöse-Code vor.',
  },
];

const COMPARE = [
  { topic: 'An der Theke', qr: 'Ein Tablet oder Handy mit Kamera, das eingeloggt, geladen und griffbereit sein muss.', tably: 'Ein Stempel. Kein Akku, kein Login, kein Bildschirm.' },
  { topic: 'Handgriffe', qr: 'Scanner öffnen, Code des Gastes erfassen, Anzahl wählen, bestätigen.', tably: 'Stempel ans Handy halten.' },
  { topic: 'Wer löst aus', qr: 'Je nach System das Team – oder der Gast selbst an einem Aufsteller.', tably: 'Immer dein Team. Der Stempel bleibt in eurer Hand.' },
  { topic: 'Schutz vor Kopien', qr: 'Hängt vom Anbieter ab. Ein statischer Code lässt sich abfotografieren.', tably: 'Jeder Tap erzeugt einen neuen, signierten Link, der einmal gilt.' },
];

const SECURITY = [
  { icon: Fingerprint, title: 'Jeder Tap ist einmalig', text: 'Der Chip im Stempel signiert jeden Tap mit einem fortlaufenden Zähler. Der Server prüft die Signatur und nimmt jeden Zählerstand genau einmal an.' },
  { icon: UserCheck, title: 'Du bestimmst, wann gebucht wird', text: 'Ein Tap ist kein Kaufnachweis. Deshalb wählst du je Karte: automatisch mit Limits, Freigabe durch das Team oder Kopplung an die Kasse.' },
  { icon: KeyRound, title: 'DSGVO-Funktionen eingebaut', text: 'Einwilligungen werden protokolliert. Auskunft und Löschung können deine Kund:innen direkt in ihrer Karte auslösen.' },
  { icon: Server, title: 'EU-Hosting als Ziel', text: 'Wir richten den Betrieb auf Hosting in der EU aus. Die Website kommt ohne Tracking-Cookies und ohne Analysedienste Dritter aus.' },
];

export default async function HomePage() {
  const { plans, trialDays } = await getPlans();
  const faq = pickFaq(['app', 'geraete', 'ablauf', 'foto', 'stempelpreis']);
  const examples = ['bakery', 'barbershop', 'florist', 'fitness', 'beauty', 'carwash'].map((id) => INDUSTRIES.find((i) => i.id === id)!);

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <Container className="grid grid-cols-1 items-center gap-x-12 gap-y-14 pb-20 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:pb-28 lg:pt-20">
          <div>
            <Eyebrow>Digitale Treuekarten mit NFC-Stempel</Eyebrow>
            <h1 className="mt-6 font-display text-[2.7rem] leading-[1.03] tracking-[-0.025em] text-ink text-balance sm:text-6xl lg:text-[4.4rem]">
              Der Stempel bleibt. <span className="text-brand">Das Papier geht.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty sm:text-xl">
              Tably macht aus deiner Stempelkarte eine digitale Karte auf dem Smartphone deiner Gäste. Gestempelt wird wie immer: mit einem echten Stempel, den dein Team kurz ans Handy hält.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <PrimaryCta />
              <SecondaryCta href="#so-funktionierts">So funktioniert&apos;s</SecondaryCta>
            </div>
            <p className="mt-4 text-sm text-muted">{trialDays} Tage kostenlos testen. Der Stempel ist separat erhältlich – Preis auf Anfrage.</p>

            <ul className="mt-10 grid grid-cols-1 max-w-xl gap-x-8 gap-y-3 border-t border-line pt-8 text-[15px] text-ink sm:grid-cols-2">
              {['Keine App für deine Gäste', 'Kein Scanner und kein Tablet an der Theke', 'Jeder Tap wird einzeln geprüft', 'Karte im Browser, optional in der Wallet'].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check className="mt-1 size-4 shrink-0 text-honey" strokeWidth={3} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroDemo />
        </Container>
      </div>

      {/* So funktioniert's */}
      <Section id="so-funktionierts" tone="surface">
        <Container>
          <SectionHeading eyebrow="So funktioniert's" title="Vier Schritte – einer davon gehört deinem Gast." lead="Wir versprechen kein Stempeln ohne jede Berührung. Dafür eines, das an der Theke nicht aufhält und das jede:r sofort versteht." />
          <ol className="mt-14 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-4">
                  <span className="tabular font-display text-5xl leading-none text-honey">{i + 1}</span>
                  <span className="h-px flex-1 bg-line" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <Reveal>
            <div className="mt-14 grid grid-cols-1 gap-6 rounded-3xl border border-line bg-paper p-6 sm:p-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
              <p className="font-display text-2xl leading-snug text-ink md:max-w-[15rem]">Was dein Gast wirklich tun muss</p>
              <dl className="grid grid-cols-1 gap-6 text-[15px] leading-relaxed sm:grid-cols-3">
                <div>
                  <dt className="font-semibold text-ink">iPhone (ab iPhone XS)</dt>
                  <dd className="mt-1.5 text-muted">Display an, Stempel an den oberen Rand der Rückseite. Die erscheinende Mitteilung einmal antippen.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Android mit NFC</dt>
                  <dd className="mt-1.5 text-muted">Gerät entsperrt, NFC eingeschaltet. Viele Geräte öffnen die Karte direkt, neuere Versionen fragen kurz nach.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Ohne NFC</dt>
                  <dd className="mt-1.5 text-muted">Karte über QR-Code oder Link öffnen; dein Team bucht den Stempel im Dashboard.</dd>
                </div>
              </dl>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Warum ein Stempel */}
      <Section>
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <SectionHeading eyebrow="Warum ein Stempel" title="Eine Geste, die jede Theke schon kennt." />
              <p className="mt-5 text-lg leading-relaxed text-muted">Die meisten digitalen Stempelkarten verlangen ein Gerät mit Kamera, an dem dein Team scannt. Das funktioniert – kostet im Stoßgeschäft aber Aufmerksamkeit. Tably nimmt die Technik aus dem Blickfeld.</p>
              <p className="mt-5 text-[15px] leading-relaxed text-muted">
                <strong className="font-semibold text-ink">Fairerweise:</strong> Ein QR-Code funktioniert mit jedem Kamerahandy. Deshalb bleibt bei Tably der Weg über QR-Code und manuelle Buchung als Rückfallebene erhalten.
              </p>
              <TextLink href="/hardware" className="mt-7">
                Den Stempel ansehen
              </TextLink>
            </div>
            <Reveal>
              <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
                <div className="hidden grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,1fr)] border-b border-line text-[13px] font-semibold uppercase tracking-[0.1em] md:grid" aria-hidden>
                  <span className="px-6 py-4" />
                  <span className="px-6 py-4 text-subtle">QR-Scan durch das Team</span>
                  <span className="bg-brand-soft/60 px-6 py-4 text-brand">Tably-Stempel</span>
                </div>
                {COMPARE.map((row) => (
                  <div key={row.topic} className="grid grid-cols-1 border-b border-line last:border-b-0 md:grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,1fr)]">
                    <h3 className="px-5 pt-5 text-[15px] font-semibold text-ink md:px-6 md:py-5">{row.topic}</h3>
                    <p className="px-5 pt-2 text-[15px] leading-relaxed text-muted md:px-6 md:py-5">
                      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-subtle md:sr-only">QR-Scan durch das Team</span>
                      {row.qr}
                    </p>
                    <p className="mt-4 bg-brand-soft/60 px-5 py-4 text-[15px] leading-relaxed text-ink md:mt-0 md:px-6 md:py-5">
                      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-brand md:sr-only">Tably-Stempel</span>
                      {row.tably}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Funktionen */}
      <Section tone="surface">
        <Container>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow="Funktionen" title="Alles, was eine Stempelkarte braucht. Und was Papier nie konnte." />
            <TextLink href="/funktionen" className="shrink-0">
              Alle Funktionen
            </TextLink>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-6">
            <Reveal className="lg:col-span-3">
              <article className="flex h-full min-w-0 flex-col rounded-3xl border border-line bg-paper p-6 sm:p-8">
                <h3 className="font-display text-2xl text-ink">Karten-Designer</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">Deine Farben, dein Logo, dein Symbol. Du siehst die Karte genau so, wie sie später auf dem Handy erscheint.</p>
                <DesignerMock className="mt-8" />
              </article>
            </Reveal>
            <Reveal className="lg:col-span-3" delay={80}>
              <article className="flex h-full min-w-0 flex-col rounded-3xl border border-line bg-paper p-6 sm:p-8">
                <h3 className="font-display text-2xl text-ink">Die Theke im Blick</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">Jeder Tap erscheint live. Je nach Richtlinie wird sofort gebucht, mit einem Klick freigegeben – oder begründet abgelehnt.</p>
                <TapFeedMock className="mt-8" />
              </article>
            </Reveal>
            <Reveal className="lg:col-span-2">
              <article className="flex h-full min-w-0 flex-col rounded-3xl border border-line bg-paper p-6 sm:p-8">
                <h3 className="font-display text-2xl text-ink">Marketing mit Einwilligung</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">Angebote, Geburtstagsgrüße, Rückgewinnung und Bonus-Stempel – nur an Menschen, die zugestimmt haben.</p>
                <CampaignMock className="mt-8" />
              </article>
            </Reveal>
            <Reveal className="lg:col-span-2" delay={80}>
              <article className="flex h-full min-w-0 flex-col rounded-3xl border border-line bg-paper p-6 sm:p-8">
                <h3 className="font-display text-2xl text-ink">Analysen</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">Welche Tage laufen, wer wiederkommt, welche Prämie zieht. Je Standort, Stempel und Karte.</p>
                <AnalyticsMock className="mt-8" />
              </article>
            </Reveal>
            <Reveal className="lg:col-span-2" delay={160}>
              <article className="flex h-full min-w-0 flex-col rounded-3xl border border-line bg-paper p-6 sm:p-8">
                <h3 className="font-display text-2xl text-ink">Und außerdem</h3>
                <dl className="mt-5 divide-y divide-line text-[15px]">
                  {[
                    ['Kundenverwaltung', 'Profile, Verlauf, manuelle Korrekturen'],
                    ['Geräteverwaltung', 'Stempel zuordnen, auswerten, sperren'],
                    ['Wallet-Karten', 'Apple und Google, nach Einrichtung'],
                    ['Team & Rollen', 'Vier Rollen mit klaren Rechten'],
                    ['Kassen-Schnittstelle', 'Stempel an Bons koppeln (API)'],
                  ].map(([k, v]) => (
                    <div key={k} className="py-3.5 first:pt-0">
                      <dt className="font-semibold text-ink">{k}</dt>
                      <dd className="mt-0.5 text-muted">{v}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Kartenvorschau */}
      <Section id="vorschau">
        <Container>
          <SectionHeading eyebrow="Ausprobieren" title="Wie sähe deine Karte aus?" lead="Wähle Branche, Farbwelt und Stempelzahl. Die Vorschau nutzt dieselbe Komponente wie die echte Karte." />
          <div className="mt-12">
            <CardConfigurator />
          </div>
        </Container>
      </Section>

      {/* Branchen */}
      <Section tone="surface">
        <Container>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow="Branchen" title="Vom Café bis zur Waschstraße." lead="Überall, wo Menschen wiederkommen, lohnt sich eine Karte. Ein paar Beispiele – alle Betriebe sind frei erfunden." />
            <TextLink href="/branchen" className="shrink-0">
              Alle Branchen
            </TextLink>
          </div>
          <ul className="mt-14 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((ex, i) => (
              <li key={ex.id}>
                <Reveal delay={(i % 3) * 80}>
                  <Link href={`/branchen#${ex.id}`} className="group block rounded-[28px]">
                    <LoyaltyCard compact data={ex.card} className="shadow-raised transition-transform duration-300 group-hover:-translate-y-1" />
                    <p className="mt-5 text-[15px] font-semibold text-ink group-hover:text-brand">{ex.label}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-muted">{ex.headline}</p>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Sicherheit */}
      <section className="scroll-mt-20 bg-[#1f3a2e] py-20 text-white sm:py-28" id="sicherheit">
        <Container>
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:gap-20">
            <div>
              <p className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/75">
                <span className="h-px w-6 bg-[#e8b86d]" aria-hidden />
                Sicherheit &amp; Datenschutz
              </p>
              <h2 className="mt-4 max-w-xl font-display text-[2rem] leading-[1.12] tracking-[-0.015em] text-balance sm:text-[2.75rem]">Ein Foto vom Stempel bringt keinen Stempel.</h2>
              <dl className="mt-12 grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2">
                {SECURITY.map((s) => (
                  <div key={s.title}>
                    <dt className="flex items-center gap-3 font-semibold">
                      <s.icon className="size-5 shrink-0 text-[#e8b86d]" aria-hidden />
                      {s.title}
                    </dt>
                    <dd className="mt-2.5 text-[15px] leading-relaxed text-white/75">{s.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Reveal>
              <div>
                <TapCheckMock />
                <p className="mt-4 text-sm leading-relaxed text-white/65">Im Stempel arbeitet ein NXP NTAG 424 DNA. Was er kann – und was er nicht beweist – steht offen auf der <Link href="/hardware#sicherheit" className="font-medium text-white underline underline-offset-4 hover:no-underline focus-visible:outline-white">Hardware-Seite</Link>.</p>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Preise */}
      <Section>
        <Container>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow="Preise" title="Drei Tarife, klar begrenzt." lead={`${trialDays} Tage kostenlos testen. Alle Preise zzgl. MwSt.; der Stempel ist separat erhältlich.`} />
            <TextLink href="/preise" className="shrink-0">
              Tarife vergleichen
            </TextLink>
          </div>
          <ul className="mt-12 grid grid-cols-1 overflow-hidden rounded-3xl border border-line bg-surface shadow-card md:grid-cols-3 md:divide-x md:divide-line">
            {plans.map((plan) => (
              <li key={plan.id} className="border-b border-line p-6 last:border-b-0 sm:p-8 md:border-b-0">
                <h3 className="font-display text-2xl text-ink">{plan.name}</h3>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="tabular font-display text-4xl tracking-tight text-ink">{formatMoney(plan.priceMonthlyCents, plan.currency)}</span>
                  <span className="text-sm text-muted">pro Monat</span>
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-muted">{plan.description}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* FAQ */}
      <Section tone="surface">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
            <div>
              <SectionHeading eyebrow="Häufige Fragen" title="Kurz gefragt, ehrlich beantwortet." />
              <TextLink href="/faq" className="mt-7">
                Alle Fragen und Antworten
              </TextLink>
            </div>
            <FaqList items={faq} />
          </div>
        </Container>
      </Section>

      <div className="pt-20 sm:pt-28">
        <ClosingCta />
      </div>
    </>
  );
}
