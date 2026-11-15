import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { Badge } from '@tably/ui';
import { Reveal } from '@/components/marketing/reveal';
import { StampDimensions, StampExploded, StampSide } from '@/components/marketing/stamp';
import { ClosingCta, Container, Eyebrow, Section, SectionHeading, TextLink } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Der NFC-Stempel',
  description: 'Der Tably-Stempel: Ø 44 × 80 mm, vier Teile, austauschbarer NFC-Chip NXP NTAG 424 DNA, individuelle Logo-Scheibe. Ohne Batterie, jede URL nur einmal gültig. Vorbestellbar über Kontakt, Preis auf Anfrage.',
};

const PARTS = [
  { n: 1, title: 'Logo-Scheibe', text: 'Sitzt oben im Knauf und trägt dein Zeichen als feine Gravur. Sie ist das individuelle Teil des Stempels und lässt sich austauschen.' },
  { n: 2, title: 'Griff', text: 'Knauf, Taille, Bund – die Form eines klassischen Holzstempels. Im Inneren ist Platz für ein optionales Gewicht, das den Stempel satter in der Hand liegen lässt.' },
  { n: 3, title: 'Fuß', text: 'Nimmt den Chip in einer flachen Tasche auf. Griff und Kappe werden mit runden, schmutzunempfindlichen Gewinden verschraubt – ohne Schrauben, ohne Metall in Chipnähe.' },
  { n: 4, title: 'NFC-Chip', text: 'Ein passiver NXP NTAG 424 DNA. Er liegt zentrisch unter der Stempelfläche und kann getauscht werden, ohne den Stempel zu ersetzen.' },
  { n: 5, title: 'Abdeckkappe', text: 'Die Stempelfläche. Ein Millimeter Material liegt zwischen Chip und Smartphone; umlaufende Griffrillen erleichtern das Aufschrauben. Als Verschleißteil ist sie einzeln ersetzbar.' },
];

const SPECS: Array<[string, string]> = [
  ['Gesamtmaß', 'Ø 44 × 80 mm'],
  ['Knauf / Taille / Bund', 'Ø 34 / Ø 19 / Ø 30 mm'],
  ['Höhe Fuß', '18 mm'],
  ['Aufbau', 'Vier Teile: Griff, Fuß, Abdeckkappe, Logo-Scheibe'],
  ['Chip', 'NXP NTAG 424 DNA, passiv (13,56 MHz), austauschbar'],
  ['Stromversorgung', 'Keine. Kein Akku, kein Kabel, kein Funkmodul'],
  ['Material (Revision A)', '3D-gedruckter Kunststoff, bevorzugt PETG'],
  ['Reinigung', 'Feucht abwischen; nicht für die Spülmaschine'],
];

const PROVES = ['Der Link stammt von einem echten Tably-Chip, der den geheimen Schlüssel kennt.', 'Kennung und Zählerstand wurden nicht verändert.', 'Jede Kombination aus Chip und Zählerstand kommt nur einmal vor – Wiederholungen fallen auf.'];
const NOT_PROVES = ['Einen Kauf. Der Chip weiß nichts von Kasse oder Bon.', 'Wer den Link einlöst. Ein Link lässt sich weitergeben – aber nur einmal einlösen.', 'Dass niemand den Stempel zweckentfremdet. Dagegen helfen Limits, Freigabe und Sperrung.'];

export default function HardwarePage() {
  return (
    <>
      <div className="relative overflow-hidden border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="max-w-2xl">
            <Eyebrow>Hardware</Eyebrow>
            <h1 className="mt-5 font-display text-[2.5rem] leading-[1.06] tracking-[-0.02em] text-ink text-balance sm:text-6xl">Ein Stempel, wie man ihn kennt. Nur ohne Stempelkissen.</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted text-pretty sm:text-xl">
              Vier Teile, ein Chip, keine Batterie. Der Tably-Stempel liegt in der Hand wie ein klassischer Holzstempel – und übergibt beim Antippen einen kryptografisch signierten Link an das Smartphone deines Gastes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href="/kontakt?thema=hardware" className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 font-medium text-on-brand transition-colors hover:bg-brand-hover">
                Stempel vorbestellen
              </Link>
              <Badge tone="honey" className="px-3 py-1.5 text-[13px]">
                Preis auf Anfrage
              </Badge>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted">Der Stempel wird derzeit für die Serienfertigung vorbereitet. Preis und Lieferumfang stehen noch nicht fest; wir nennen keinen Liefertermin, den wir nicht halten können.</p>
          </div>
          <div className="relative mx-auto flex w-full max-w-sm items-end justify-center pb-6 pt-4">
            <div className="absolute bottom-0 left-1/2 size-80 max-w-full -translate-x-1/2 rounded-full bg-brand-soft/70" aria-hidden />
            <div className="absolute bottom-4 left-1/2 h-5 w-44 -translate-x-1/2 rounded-[50%] bg-ink/15 blur-md" aria-hidden />
            <StampSide className="relative w-44 sm:w-52" title="Der Tably-Stempel: heller Griff mit honigfarbener Logo-Scheibe, dunkelgrüner Fuß mit geriffelter Kappe" />
          </div>
        </Container>
      </div>

      {/* Aufbau */}
      <Section>
        <Container>
          <SectionHeading eyebrow="Aufbau" title="Vier Teile und ein Chip." lead="Alles ist verschraubt, nichts verklebt oder vergossen. Was verschleißt oder sich ändert, lässt sich einzeln tauschen." />
          <div className="mt-14 grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
            <Reveal>
              <div className="rounded-[2rem] border border-line bg-surface p-6 sm:p-10">
                <StampExploded className="mx-auto max-w-[300px]" />
              </div>
            </Reveal>
            <ol className="divide-y divide-line border-y border-line">
              {PARTS.map((p) => (
                <li key={p.n} className="flex gap-5 py-6">
                  <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink" aria-hidden>
                    {p.n}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{p.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Section>

      {/* Maße & Material */}
      <Section tone="surface">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-20">
            <div>
              <SectionHeading eyebrow="Maße & Material" title="Klein genug für jede Theke, groß genug für jede Hand." />
              <dl className="mt-10 divide-y divide-line border-y border-line text-[15px]">
                {SPECS.map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-3.5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
                    <dt className="text-muted">{k}</dt>
                    <dd className="tabular font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-sm leading-relaxed text-muted">Stand: Revision A der Konstruktion. Material, Oberfläche und Fertigungsverfahren der Serie können davon abweichen. Der Stempel ist ein Thekenwerkzeug und nicht für den direkten Kontakt mit Lebensmitteln bestimmt.</p>
            </div>
            <Reveal>
              <div className="rounded-[2rem] border border-line bg-paper p-4 sm:p-8">
                <StampDimensions className="mx-auto max-w-[380px]" />
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Haptik & Funktion */}
      <Section>
        <Container>
          <SectionHeading eyebrow="In der Hand" title="Wie er sich anfühlt. Wie er funktioniert." />
          <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-3">
            {[
              { t: 'Die vertraute Geste', d: 'Greifen, aufsetzen, fertig. Die taillierte Form führt die Finger von selbst; die flache Stempelfläche zeigt, welche Seite ans Handy gehört. Niemand im Team braucht dafür eine Einweisung in eine App.' },
              { t: 'Flach aufsetzen, kurz halten', d: 'Beim iPhone an den oberen Rand der Rückseite, bei Android meist in die Mitte. Unser Merksatz für die Theke: iPhone oben, Android Mitte. Dicke Hüllen verkürzen die Reichweite.' },
              { t: 'Passiv und wartungsarm', d: 'Der Chip bezieht seine Energie für den Moment des Lesens aus dem Smartphone. Es gibt nichts zu laden, zu koppeln oder einzuloggen – und nichts, das abends ausgeschaltet werden müsste.' },
            ].map((x) => (
              <div key={x.t} className="border-t border-line-strong pt-6">
                <h3 className="font-display text-2xl text-ink">{x.t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{x.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 grid gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
            <div>
              <h3 className="font-display text-2xl text-ink">Dein Zeichen im Griff</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">Die Logo-Scheibe wird für deinen Betrieb gefertigt. Weil der Stempel aus getrennten Teilen besteht, sind Griff, Fuß und Kappe grundsätzlich in unterschiedlichen Farben möglich. Welche Varianten es zum Serienstart gibt, klären wir bei der Vorbestellung.</p>
            </div>
            <div>
              <h3 className="font-display text-2xl text-ink">Was beim Gast passiert</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">Das Smartphone liest den Link und zeigt eine Mitteilung; nach dem Antippen öffnet sich die Karte im Browser. Auf dem iPhone ist dieses Antippen immer nötig, auf neueren Android-Versionen ebenfalls. Eine App ist nicht erforderlich.</p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Sicherheit */}
      <section id="sicherheit" className="scroll-mt-20 bg-[#1f3a2e] py-20 text-white sm:py-28">
        <Container>
          <p className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/75">
            <span className="h-px w-6 bg-[#e8b86d]" aria-hidden />
            Sicherheit
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-[2rem] leading-[1.12] tracking-[-0.015em] text-balance sm:text-[2.75rem]">Jede URL gilt genau einmal.</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">
            Im Fuß arbeitet ein NXP NTAG 424 DNA. Der Chip hängt bei jedem Lesen einen fortlaufenden Zähler und eine mit AES-128 berechnete Signatur an den Link. Unser Server prüft die Signatur mit dem Schlüssel dieses einen Stempels und nimmt jeden Zählerstand nur ein einziges Mal an.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-6 sm:p-8">
              <h3 className="font-display text-2xl">Was ein Tap beweist</h3>
              <ul className="mt-5 space-y-3.5 text-[15px] leading-relaxed text-white/85">
                {PROVES.map((t) => (
                  <li key={t} className="flex gap-3">
                    <Check className="mt-1 size-4 shrink-0 text-[#8fd9ae]" strokeWidth={3} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-6 sm:p-8">
              <h3 className="font-display text-2xl">Was er nicht beweist</h3>
              <ul className="mt-5 space-y-3.5 text-[15px] leading-relaxed text-white/85">
                {NOT_PROVES.map((t) => (
                  <li key={t} className="flex gap-3">
                    <X className="mt-1 size-4 shrink-0 text-[#ffb3a8]" strokeWidth={3} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-8 max-w-3xl text-[15px] leading-relaxed text-white/70">
            Deshalb gibt es die{' '}
            <Link href="/funktionen#richtlinien" className="font-medium text-white underline underline-offset-4 hover:no-underline focus-visible:outline-white">
              Buchungsrichtlinien
            </Link>
            : Du entscheidest je Karte, ob ein gültiger Tap sofort bucht, vom Team freigegeben wird oder ein Kassen-Ereignis braucht. Geht ein Stempel verloren, sperrst du ihn im Dashboard.
          </p>
        </Container>
      </section>

      {/* Ausblick */}
      <Section id="ausblick">
        <Container>
          <div className="grid gap-10 rounded-[2rem] border border-dashed border-line-strong p-6 sm:p-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <Badge tone="warn" dot>
                In Entwicklung · kein Liefertermin
              </Badge>
              <h2 className="mt-5 font-display text-[2rem] leading-[1.12] tracking-[-0.015em] text-ink sm:text-[2.5rem]">Ausblick: aktiver Stempel</h2>
              <p className="mt-5 text-lg leading-relaxed text-muted">Wir arbeiten an einer Ausbaustufe mit eigener Elektronik: ein Stempel, der die Wallet-Karte direkt lesen und selbst Rückmeldung geben kann, etwa per Licht oder Vibration.</p>
            </div>
            <div className="space-y-5 text-[15px] leading-relaxed text-muted">
              <p>
                <strong className="font-semibold text-ink">Was das voraussetzt.</strong> Das direkte Lesen von Wallet-Karten läuft über Verfahren von Apple und Google, für die Freigaben, Zertifikate und dafür zugelassene Leser-Hardware nötig sind. Ob und wann wir diese Freigaben erhalten, liegt nicht in unserer Hand.
              </p>
              <p>
                <strong className="font-semibold text-ink">Was das für dich heißt.</strong> Plane mit dem passiven Stempel. Er ist das Produkt, das wir zur Serie bringen; die Plattform ist so gebaut, dass ein aktiver Stempel später als weiterer Gerätetyp dazukommen kann.
              </p>
              <p>Wir nennen keinen Termin und nehmen für den aktiven Stempel keine Vorbestellungen an.</p>
              <TextLink href="/kontakt?thema=technik">Fragen dazu stellen</TextLink>
            </div>
          </div>
        </Container>
      </Section>

      <ClosingCta title="Erst testen, dann stempeln." text="Leg ein Konto an und probiere den Ablauf mit dem simulierten Stempel im Dashboard aus. Den echten Stempel kannst du parallel über das Kontaktformular vorbestellen – Preis auf Anfrage." />
    </>
  );
}
