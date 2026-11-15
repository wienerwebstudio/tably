import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@tapperl/ui';

export interface FaqItem {
  id: string;
  q: string;
  a: React.ReactNode;
  /** Reiner Text für strukturierte Daten und Kurzfassungen */
  plain: string;
}
export interface FaqGroup {
  title: string;
  items: FaqItem[];
}

const link = 'font-medium text-brand underline underline-offset-4 hover:no-underline';

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: 'Für deine Kundschaft',
    items: [
      {
        id: 'app',
        q: 'Braucht der Kunde eine App?',
        plain: 'Nein. Die Karte öffnet sich im Browser des Smartphones. Eine Installation ist nicht nötig.',
        a: (
          <>
            <p>Nein. Die Karte öffnet sich im Browser des Smartphones. Es gibt nichts zu installieren und kein Passwort.</p>
            <p>Wer möchte, legt die Karte zusätzlich in Apple Wallet oder Google Wallet ab, sobald Wallet-Karten für deinen Betrieb aktiviert sind.</p>
          </>
        ),
      },
      {
        id: 'geraete',
        q: 'Funktioniert es mit jedem Handy?',
        plain: 'Mit iPhones ab dem iPhone XS und mit den meisten Android-Geräten mit eingeschaltetem NFC. Für alle anderen gibt es den Weg über QR-Code oder Link und die Buchung durch dein Team.',
        a: (
          <>
            <p>
              Mit den allermeisten aktuellen Smartphones: iPhones ab dem iPhone XS lesen den Stempel ohne Zusatz-App, ebenso die meisten Android-Geräte mit NFC. Auf Android muss NFC in den Einstellungen eingeschaltet und das Gerät entsperrt sein.
            </p>
            <p>
              Ältere iPhones (vor dem iPhone XS) und Geräte ohne NFC können den Stempel nicht auf diesem Weg lesen. Diese Gäste gehen trotzdem nicht leer aus: Sie öffnen ihre Karte über einen QR-Code oder Link, und dein Team bucht den Stempel im Dashboard von Hand.
            </p>
          </>
        ),
      },
      {
        id: 'ablauf',
        q: 'Was muss der Kunde beim Stempeln tun?',
        plain: 'Handy mit eingeschaltetem Display hinhalten. Auf dem iPhone erscheint eine Mitteilung, die einmal angetippt wird; danach öffnet sich die Karte mit dem neuen Stempel.',
        a: (
          <>
            <p>Das Handy mit eingeschaltetem Display hinhalten. Dein Team hält den Stempel kurz an die Rückseite – beim iPhone am oberen Rand, bei Android meist in der Mitte.</p>
            <p>
              Auf dem iPhone erscheint dann eine Mitteilung, die einmal angetippt wird; ist das Gerät gesperrt, fragt es kurz nach Face ID oder Code. Viele Android-Geräte öffnen die Karte bisher direkt, neuere Android-Versionen zeigen ebenfalls erst einen Hinweis zum Antippen. Danach erscheint die Karte mit dem neuen Stempel.
            </p>
            <p>Beim allerersten Mal legt der Gast seine Karte an: Vorname eingeben, Datenschutzhinweis bestätigen, fertig. E-Mail-Adresse und Geburtstag sind freiwillig.</p>
          </>
        ),
      },
      {
        id: 'wiederfinden',
        q: 'Wie findet der Kunde seine Karte wieder?',
        plain: 'Der Browser merkt sich die Karte über ein Cookie. Unter „Meine Karten“ sind alle Karten zu sehen. Wer eine E-Mail-Adresse hinterlegt hat, kann die Karte auf einem neuen Gerät wiederherstellen.',
        a: (
          <>
            <p>
              Der Browser merkt sich die Karte über ein einzelnes Cookie. Beim nächsten Tap ist sie sofort wieder da, und unter{' '}
              <Link href="/karten" prefetch={false} className={link}>
                Meine Karten
              </Link>{' '}
              sind alle Karten dieses Geräts zu sehen.
            </p>
            <p>Wer eine E-Mail-Adresse hinterlegt hat, kann seine Karte per Link auf ein neues Gerät holen. Ohne E-Mail-Adresse ist die Karte an den Browser gebunden – dein Team kann in dem Fall im Dashboard helfen.</p>
          </>
        ),
      },
      {
        id: 'einloesen',
        q: 'Wie wird eine Prämie eingelöst?',
        plain: 'Der Gast tippt in seiner Karte auf Einlösen und zeigt den kurz gültigen Code vor. Dein Team bestätigt ihn im Dashboard.',
        a: <p>Ist die Karte voll, tippt der Gast in seiner Karte auf „Einlösen“ und zeigt den angezeigten Code vor. Der Code ist nur wenige Minuten gültig; dein Team bestätigt ihn im Dashboard, und die Prämie ist verbucht.</p>,
      },
    ],
  },
  {
    title: 'Sicherheit & Missbrauch',
    items: [
      {
        id: 'foto',
        q: 'Was, wenn jemand die URL abfotografiert oder weiterleitet?',
        plain: 'Jeder Link gilt genau einmal. Der Chip erzeugt bei jedem Tap einen neuen, signierten Link mit fortlaufendem Zähler; der Server lehnt bereits verwendete und veraltete Zählerstände ab.',
        a: (
          <>
            <p>
              Dann hat diese Person einen Link, der genau einmal funktioniert – oder gar nicht mehr. Der Chip im Stempel erzeugt bei jedem Antippen einen neuen Link mit fortlaufendem Zähler und kryptografischer Signatur. Unser Server prüft die Signatur, nimmt jeden Zählerstand nur ein einziges Mal an und lehnt veraltete Zählerstände ab. Zusätzlich verfällt ein geprüfter Tap nach kurzer Zeit.
            </p>
            <p>Ein Foto des Bildschirms oder ein weitergeleiteter Link bringt deshalb keinen zweiten Stempel.</p>
          </>
        ),
      },
      {
        id: 'kaufnachweis',
        q: 'Beweist ein Tap, dass jemand etwas gekauft hat?',
        plain: 'Nein. Ein Tap beweist, dass der echte Stempel gelesen wurde – nicht, dass gekauft wurde. Deshalb wählst du je Karte eine Buchungsrichtlinie: automatisch mit Limits, Freigabe durch das Team oder Kassen-Ereignis.',
        a: (
          <>
            <p>Nein, und das behaupten wir auch nicht. Ein Tap beweist, dass der echte Stempel gelesen wurde. Ob dazu ein Kauf gehört, weiß der Chip nicht.</p>
            <p>
              Deshalb legst du je Kartenprogramm fest, wie gebucht wird: automatisch mit Tageslimit und Auffälligkeitserkennung, erst nach Freigabe durch dein Team oder nur, wenn deine Kasse einen passenden Bon gemeldet hat. Details stehen unter{' '}
              <Link href="/funktionen#richtlinien" className={link}>
                Buchungsrichtlinien
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        id: 'verlust',
        q: 'Was passiert, wenn der Stempel verloren geht oder gestohlen wird?',
        plain: 'Du sperrst ihn im Dashboard. Ab dann wird kein Tap dieses Stempels mehr angenommen.',
        a: <p>Du sperrst ihn im Dashboard. Ab diesem Moment nimmt der Server keinen Tap dieses Stempels mehr an. Karten und Stempelstände deiner Kundschaft bleiben unberührt, ein Ersatzstempel wird einfach neu zugeordnet.</p>,
      },
      {
        id: 'vorrat',
        q: 'Kann das Personal Stempel „auf Vorrat“ sammeln?',
        plain: 'Wer den Stempel in der Hand hat, kann ihn an ein Handy halten. Dagegen helfen Tageslimits, die Freigabe durch das Team, die Kassen-Kopplung und die Auswertung je Stempel.',
        a: <p>Wer den Stempel in der Hand hat, kann ihn an ein Handy halten – das ist bei Papier nicht anders. Tapperl begrenzt den Schaden: Tageslimit je Karte, markierte Auffälligkeiten, abgelehnte Taps in der Auswertung je Stempel und, wenn du es strenger brauchst, die Freigabe oder die Kopplung an die Kasse.</p>,
      },
    ],
  },
  {
    title: 'Stempel & Wallet',
    items: [
      {
        id: 'stempelpreis',
        q: 'Was kostet der Stempel?',
        plain: 'Der Preis steht noch nicht fest. Der Stempel wird für die Serienfertigung vorbereitet und kann über das Kontaktformular vorbestellt werden – Preis auf Anfrage.',
        a: (
          <p>
            Das steht noch nicht fest. Der Stempel ist ein eigenes Hardwareprodukt und wird gerade für die Serienfertigung vorbereitet. Er ist nicht im Software-Tarif enthalten; du kannst ihn über das{' '}
            <Link href="/kontakt?thema=hardware" className={link}>
              Kontaktformular
            </Link>{' '}
            vorbestellen – Preis auf Anfrage. Bis dahin testest du alles mit dem simulierten Stempel im Dashboard.
          </p>
        ),
      },
      {
        id: 'akku',
        q: 'Braucht der Stempel Strom, WLAN oder eine App?',
        plain: 'Nein. Der Stempel ist passiv: Er enthält einen NFC-Chip ohne Batterie, der vom Smartphone mit Energie versorgt wird.',
        a: <p>Nein. Im Fuß sitzt ein passiver NFC-Chip ohne Batterie; die Energie kommt für den Moment des Lesens vom Smartphone. Der Stempel muss nicht geladen, nicht gekoppelt und nicht eingeloggt werden.</p>,
      },
      {
        id: 'wallet',
        q: 'Gibt es die Karte in Apple Wallet und Google Wallet?',
        plain: 'Ja, Wallet-Karten werden unterstützt. Die Aktivierung erfordert eine Einrichtung beim jeweiligen Anbieter; bei Google gehört eine Freischaltung durch Google dazu.',
        a: (
          <>
            <p>Ja, Tapperl unterstützt Wallet-Karten für beide Plattformen. Die Karte im Browser funktioniert immer; die Wallet-Karte ist eine zusätzliche Ablage.</p>
            <p>Wichtig: Die Aktivierung erfordert eine Einrichtung beim jeweiligen Anbieter – bei Apple ein Zertifikat aus einem Entwicklerkonto, bei Google ein Aussteller-Konto, das Google erst freischalten muss. Wie lange Google dafür braucht, können wir nicht zusagen. Ob Wallet-Karten für dein Konto schon verfügbar sind, klären wir gern mit dir.</p>
          </>
        ),
      },
      {
        id: 'aktiv',
        q: 'Kann der Stempel direkt mit der Wallet-Karte sprechen, ganz ohne Antippen?',
        plain: 'Heute nicht. Ein aktiver Stempel ist in Entwicklung und hängt von Freigaben durch Apple und Google ab. Es gibt keinen Liefertermin.',
        a: (
          <p>
            Heute nicht. Dafür bräuchte es einen aktiven Stempel mit eigener Elektronik und Freigaben von Apple und Google. Daran arbeiten wir, ein Termin lässt sich aber nicht seriös nennen. Mehr dazu unter{' '}
            <Link href="/hardware#ausblick" className={link}>
              Ausblick: aktiver Stempel
            </Link>
            .
          </p>
        ),
      },
    ],
  },
  {
    title: 'Tarif, Vertrag & Datenschutz',
    items: [
      {
        id: 'test',
        q: 'Wie läuft die kostenlose Testphase ab?',
        plain: 'Du legst ein Konto an und testest 14 Tage kostenlos mit dem Umfang des Business-Tarifs. Der simulierte Stempel im Dashboard ersetzt in dieser Zeit die Hardware.',
        a: <p>Du legst ein Konto an und testest 14 Tage kostenlos mit dem Umfang des Business-Tarifs. Einen Stempel brauchst du dafür noch nicht: Im Dashboard gibt es einen simulierten Stempel, der dieselbe Prüfung durchläuft wie die Hardware.</p>,
      },
      {
        id: 'kuendigung',
        q: 'Wie kann ich kündigen?',
        plain: 'Im Dashboard in den Einstellungen. Die Kündigung wird zum Ende des laufenden Abrechnungszeitraums wirksam.',
        a: <p>Im Dashboard in den Einstellungen, ohne Anruf und ohne Formular. Die Kündigung wird zum Ende des laufenden Abrechnungszeitraums wirksam; bis dahin kannst du sie auch wieder zurücknehmen. Die verbindlichen Regelungen stehen in den AGB.</p>,
      },
      {
        id: 'preise',
        q: 'Sind die Preise inklusive Mehrwertsteuer?',
        plain: 'Nein. Alle Preise verstehen sich zuzüglich der gesetzlichen Mehrwertsteuer. Der Stempel ist nicht enthalten.',
        a: <p>Nein. Tapperl richtet sich an Unternehmen, alle Preise verstehen sich zuzüglich der gesetzlichen Mehrwertsteuer. Der Stempel (Hardware) ist nicht im Tarif enthalten.</p>,
      },
      {
        id: 'datenschutz',
        q: 'Welche Daten werden von meinen Kund:innen gespeichert?',
        plain: 'Vorname, freiwillig E-Mail-Adresse und Geburtstag, die Stempelhistorie, die Einwilligungen und ein Cookie zur Wiedererkennung der Karte. Keine Tracking-Cookies.',
        a: (
          <>
            <p>So wenig wie möglich: der Vorname, freiwillig E-Mail-Adresse und Geburtstag, die Stempel- und Einlösehistorie, die erteilten Einwilligungen und ein Cookie, über das der Browser die Karte wiedererkennt. Tracking-Cookies oder Analysedienste Dritter setzen wir nicht ein.</p>
            <p>
              Deine Kund:innen können ihre Daten selbst in der Karte exportieren und löschen. Werbliche Nachrichten gehen nur an Personen, die ausdrücklich eingewilligt haben. Einzelheiten stehen in den{' '}
              <Link href="/datenschutz" className={link}>
                Datenschutzhinweisen
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        id: 'hosting',
        q: 'Wo werden die Daten gehostet?',
        plain: 'Unser Ziel ist ein Hosting ausschließlich in der EU. Der konkrete Anbieter und Standort werden vor dem Start in den Datenschutzhinweisen genannt.',
        a: <p>Unser Ziel ist ein Hosting ausschließlich in der Europäischen Union. Den konkreten Anbieter und Standort nennen wir in den Datenschutzhinweisen und im Vertrag zur Auftragsverarbeitung, sobald sie verbindlich feststehen.</p>,
      },
      {
        id: 'mehrere',
        q: 'Kann ich mehrere Standorte und mehrere Karten verwalten?',
        plain: 'Ja. Je nach Tarif sind mehrere Standorte, Stempel und Kartenprogramme enthalten.',
        a: (
          <p>
            Ja. Je nach Tarif sind mehrere Standorte, Stempel und Kartenprogramme enthalten; die genauen Zahlen stehen auf der{' '}
            <Link href="/preise" className={link}>
              Preisseite
            </Link>
            . Jeder Stempel wird einem Standort zugeordnet und einzeln ausgewertet.
          </p>
        ),
      },
    ],
  },
];

export function pickFaq(ids: string[]): FaqItem[] {
  const all = FAQ_GROUPS.flatMap((g) => g.items);
  return ids.map((id) => all.find((i) => i.id === id)).filter((i): i is FaqItem => Boolean(i));
}

/** Zugängliches Accordion auf Basis von <details> – funktioniert ohne JavaScript. */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn('divide-y divide-line border-y border-line', className)}>
      {items.map((item) => (
        <details key={item.id} id={item.id} className="group scroll-mt-24">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left text-[17px] font-medium leading-snug text-ink transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-muted transition-transform duration-200 group-open:rotate-45" aria-hidden>
              <Plus className="size-4" />
            </span>
          </summary>
          <div className="max-w-2xl space-y-3 pb-6 pr-10 text-[16px] leading-relaxed text-muted">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
