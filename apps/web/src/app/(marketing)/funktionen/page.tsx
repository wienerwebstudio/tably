import type { Metadata } from 'next';
import { Alert, cn, LoyaltyCard } from '@tably/ui';
import { AnalyticsMock, ApiMock, CampaignMock, CustomersMock, DesignerMock, DevicesMock, PolicyMock, TeamMock } from '@/components/marketing/mocks';
import { Reveal } from '@/components/marketing/reveal';
import { HERO_CARD } from '@/components/marketing/site';
import { CheckList, ClosingCta, Container, PageHero, PrimaryCta, SecondaryCta, TextLink } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Funktionen',
  description: 'Kartendesigner, Kundenverwaltung, NFC-Stempel und Geräteverwaltung, Buchungsrichtlinien gegen Missbrauch, Wallet-Karten, Marketing, Analysen, Team und Rollen, Kassen-Schnittstelle: alle Funktionen von Tably im Überblick.',
};

function WalletMock() {
  return (
    <div className="relative mx-auto max-w-sm" aria-hidden>
      <div className="absolute inset-x-6 -top-3 h-12 rounded-t-[22px] bg-[#16223B] opacity-80" />
      <div className="absolute inset-x-3 -top-1.5 h-12 rounded-t-[24px] bg-[#7A2E22] opacity-90" />
      <LoyaltyCard compact data={{ ...HERO_CARD, balance: 8 }} className="relative shadow-raised" />
      <div className="mt-5 grid grid-cols-2 gap-3 text-center text-[13px] font-medium">
        <span className="rounded-xl border border-line-strong bg-surface py-2.5 text-ink">Apple Wallet</span>
        <span className="rounded-xl border border-line-strong bg-surface py-2.5 text-ink">Google Wallet</span>
      </div>
    </div>
  );
}

const FEATURES: Array<{ id: string; nav: string; title: string; lead: string; points: React.ReactNode[]; visual: React.ReactNode; note?: React.ReactNode }> = [
  {
    id: 'kartendesigner',
    nav: 'Kartendesigner',
    title: 'Eine Karte, die nach deinem Laden aussieht',
    lead: 'Im Designer entsteht die Karte, wie deine Gäste sie sehen – mit Live-Vorschau statt Formularfeldern ins Blaue.',
    points: ['Hintergrund-, Text- und Akzentfarbe frei wählbar, dazu dein Logo', 'Zwölf Stempelsymbole von Kaffee bis Auto', 'Stempelzahl, Prämien und Kartentext je Programm', 'Entwurf, veröffentlicht, pausiert, archiviert: Du entscheidest, wann eine Karte live ist', 'Willkommensstempel und Gültigkeitszeitraum optional'],
    visual: <DesignerMock />,
  },
  {
    id: 'kunden',
    nav: 'Kundenverwaltung',
    title: 'Wissen, wer wiederkommt',
    lead: 'Jede Karte gehört zu einem Profil. Du siehst Stand, Verlauf und Einwilligungen – und kannst eingreifen, wenn an der Theke etwas schiefging.',
    points: ['Suche, Profil mit vollständigem Buchungsverlauf, interne Notiz', 'Stempel von Hand buchen, korrigieren oder eine Buchung stornieren', 'Prämien per Einlöse-Code oder direkt am Profil einlösen', 'Karten und Kund:innen sperren, Daten exportieren, Profile anonymisieren'],
    visual: <CustomersMock />,
  },
  {
    id: 'stempel',
    nav: 'NFC-Stempel',
    title: 'Der Stempel – und alles, was du über ihn wissen musst',
    lead: 'Jeder Stempel ist ein eigenes Gerät in deinem Konto: einem Standort und einem Kartenprogramm zugeordnet, einzeln auswertbar, jederzeit sperrbar.',
    points: ['Stempel registrieren, benennen und einem Standort zuordnen', 'Auswertung je Stempel: gebuchte Stempel, abgelehnte Taps, letzte Nutzung', 'Verlorene Stempel mit einem Klick sperren', 'Simulierter Stempel im Dashboard zum Testen und Schulen – mit derselben Prüfung wie die Hardware'],
    visual: <DevicesMock />,
    note: (
      <TextLink href="/hardware" className="mt-6">
        Zur Hardware
      </TextLink>
    ),
  },
  {
    id: 'richtlinien',
    nav: 'Buchungsrichtlinien',
    title: 'Ein Tap ist kein Kaufnachweis. Also entscheidest du.',
    lead: 'Der Stempel beweist, dass er gelesen wurde – nicht, dass jemand bezahlt hat. Je Kartenprogramm legst du fest, wie viel Vertrauen genügt.',
    points: [
      <>
        <strong className="font-semibold">Automatisch mit Limits:</strong> Ein gültiger Tap bucht sofort. Mindestabstand zwischen zwei Stempeln und Tageslimit je Karte halten es fair, auffällige Häufungen werden markiert.
      </>,
      <>
        <strong className="font-semibold">Freigabe durch das Team:</strong> Jeder Tap erscheint in der Thekenansicht und wird mit einem Klick bestätigt oder abgelehnt.
      </>,
      <>
        <strong className="font-semibold">Kassen-Ereignis:</strong> Gebucht wird nur, wenn deine Kasse über die Schnittstelle einen passenden Bon gemeldet hat.
      </>,
    ],
    visual: <PolicyMock />,
  },
  {
    id: 'wallet',
    nav: 'Wallet-Karten',
    title: 'Auf Wunsch auch in Apple Wallet und Google Wallet',
    lead: 'Die Karte im Browser funktioniert immer. Wer mag, legt sie zusätzlich in der Wallet ab – dort aktualisiert sich der Stand nach jedem Stempel.',
    points: ['Wallet-Karten für Apple und Google aus demselben Kartendesign', 'Stempelstand wird nach Buchungen aktualisiert', 'Hinweise über die Wallet nur mit eigener Einwilligung'],
    visual: <WalletMock />,
    note: (
      <Alert tone="info" title="Einrichtung erforderlich" className="mt-6">
        Wallet-Karten müssen beim jeweiligen Anbieter eingerichtet werden: bei Apple über ein Zertifikat aus einem Entwicklerkonto, bei Google über ein Aussteller-Konto, das Google freischaltet.
      </Alert>
    ),
  },
  {
    id: 'marketing',
    nav: 'Marketing',
    title: 'Gründe, wiederzukommen',
    lead: 'Vier Kampagnenarten, die zu kleinen Betrieben passen – und nur Menschen erreichen, die ausdrücklich zugestimmt haben.',
    points: ['Angebote und Ankündigungen an alle oder an ein Segment, sofort oder geplant', 'Geburtstagsgruß, optional mit geschenkten Stempeln', 'Rückgewinnung nach einer Zeit ohne Besuch, die du festlegst', 'Bonus-Stempel-Aktionen: mehrfache Stempel an bestimmten Wochentagen oder im Aktionszeitraum', 'Segmente nach Aktivität, Stempelstand und einlösbarer Prämie'],
    visual: <CampaignMock />,
  },
  {
    id: 'analysen',
    nav: 'Analysen',
    title: 'Zahlen, die an der Theke etwas ändern',
    lead: 'Keine Kennzahlen-Tapete: Die Analysen beantworten, ob die Karte Menschen zurückbringt.',
    points: ['Stempel, Buchungen, Einlösungen und aktive Kund:innen im Vergleich zum Vorzeitraum', 'Neue und wiederkehrende Kund:innen, Wiederkehrquote', 'Verteilung nach Wochentagen', 'Auswertung je Standort, je Stempel und je Kartenprogramm'],
    visual: <AnalyticsMock />,
  },
  {
    id: 'team',
    nav: 'Team & Rollen',
    title: 'Jede:r sieht, was er oder sie braucht',
    lead: 'Vier Rollen mit festen Rechten. Die Aushilfe stempelt, ohne Kampagnen oder den Tarif zu sehen.',
    points: ['Inhaber:in, Admin, Manager:in, Mitarbeiter:in', 'Einladung per E-Mail, Rolle jederzeit änderbar', 'Protokoll sicherheitsrelevanter Änderungen für Inhaber:in und Admin'],
    visual: <TeamMock />,
  },
  {
    id: 'kasse',
    nav: 'Kassen-Schnittstelle',
    title: 'Den Stempel an den Bon koppeln',
    lead: 'Über eine einfache HTTP-Schnittstelle meldet deine Kasse einen Verkauf. In der Richtlinie „Kassen-Ereignis“ wird ein Tap nur gebucht, wenn ein passendes Ereignis vorliegt.',
    points: ['API-Schlüssel im Dashboard erstellen und widerrufen', 'Ereignisse sind über die eigene Bon-Nummer idempotent – doppelt gesendet heißt nicht doppelt gezählt', 'Im Premium-Tarif enthalten'],
    visual: <ApiMock />,
    note: <p className="mt-6 text-sm leading-relaxed text-muted">Fertige Anbindungen an bestimmte Kassensysteme gibt es derzeit nicht. Die Schnittstelle richtet sich an Kassenanbieter und Betriebe mit technischer Unterstützung.</p>,
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero eyebrow="Funktionen" title="Vom ersten Tap bis zur eingelösten Prämie." lead="Tably ist mehr als ein Stempel. Hier steht, was die Plattform kann – gegliedert nach dem, was du im Alltag damit tust.">
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryCta />
          <SecondaryCta href="/preise">Preise ansehen</SecondaryCta>
        </div>
      </PageHero>

      <nav aria-label="Funktionsbereiche" className="sticky top-16 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <Container>
          <ul className="-mx-2 flex gap-1 overflow-x-auto py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FEATURES.map((f) => (
              <li key={f.id} className="shrink-0">
                <a href={`#${f.id}`} className="block rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink">
                  {f.nav}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      <div className="divide-y divide-line">
        {FEATURES.map((f, i) => (
          <section key={f.id} id={f.id} className={cn('scroll-mt-32 py-16 sm:py-24', i % 2 === 1 && 'bg-surface')}>
            <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
              <div className={cn(i % 2 === 1 && 'lg:order-2')}>
                <p className="tabular font-display text-xl text-honey">{String(i + 1).padStart(2, '0')}</p>
                <h2 className="mt-3 font-display text-[1.9rem] leading-[1.14] tracking-[-0.015em] text-ink text-balance sm:text-4xl">{f.title}</h2>
                <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">{f.lead}</p>
                <CheckList items={f.points} className="mt-7" />
                {f.note}
              </div>
              <Reveal className={cn('min-w-0', i % 2 === 1 && 'lg:order-1')}>{f.visual}</Reveal>
            </Container>
          </section>
        ))}
      </div>

      <div className="pt-20 sm:pt-28">
        <ClosingCta title="Alles ausprobieren, bevor du dich festlegst." />
      </div>
    </>
  );
}
