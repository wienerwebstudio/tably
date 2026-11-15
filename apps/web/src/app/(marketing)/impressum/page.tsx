import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalAddress, LegalPage, LegalSection, Todo } from '@/components/marketing/legal';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Anbieterkennzeichnung der Tapperl-Website (Entwurf, Betreiberdaten noch zu ergänzen).',
  robots: { index: false },
};

export default function ImprintPage() {
  return (
    <LegalPage title="Impressum" intro="Anbieterkennzeichnung nach § 5 DDG (Deutschland). Für Österreich und die Schweiz gelten eigene Pflichtangaben, siehe unten.">
      <LegalSection title="Anbieter">
        <LegalAddress>
          <Todo>Firmenname mit Rechtsform</Todo>
          <br />
          <Todo>Straße und Hausnummer</Todo>
          <br />
          <Todo>Postleitzahl, Ort</Todo>
          <br />
          <Todo>Land</Todo>
        </LegalAddress>
      </LegalSection>

      <LegalSection title="Vertreten durch">
        <p>
          <Todo>Vor- und Nachname der vertretungsberechtigten Person(en), Funktion</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>
          Telefon: <Todo>Telefonnummer</Todo>
          <br />
          E-Mail: <Todo>E-Mail-Adresse</Todo>
        </p>
        <p>
          Zusätzlich erreichst du uns über das <Link href="/kontakt">Kontaktformular</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Registereintrag">
        <p>
          Registergericht: <Todo>Registergericht</Todo>
          <br />
          Registernummer: <Todo>Registernummer (z. B. HRB …) oder Hinweis, dass kein Eintrag besteht</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Umsatzsteuer-Identifikationsnummer">
        <p>
          Umsatzsteuer-Identifikationsnummer nach § 27a UStG: <Todo>USt-IdNr.</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Inhaltlich verantwortlich">
        <p>
          Verantwortlich nach § 18 Abs. 2 MStV: <Todo>Name und Anschrift der verantwortlichen Person</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Angaben für Österreich und die Schweiz">
        <p>
          <Todo>Falls das Angebot aus Österreich betrieben wird oder sich gezielt dorthin richtet: Angaben nach § 5 ECG und § 25 MedienG (u. a. Unternehmensgegenstand, Aufsichtsbehörde, Kammerzugehörigkeit)</Todo>
        </p>
        <p>
          <Todo>Falls das Angebot aus der Schweiz betrieben wird: Angaben nach Art. 3 Abs. 1 lit. s UWG (u. a. UID)</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Verbraucherstreitbeilegung">
        <p>
          <Todo>Erklärung, ob eine Bereitschaft oder Verpflichtung zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle besteht (§ 36 VSBG)</Todo>
        </p>
        <p>Das Angebot von Tapperl richtet sich an Unternehmen.</p>
      </LegalSection>

      <LegalSection title="Haftung für Inhalte und Links">
        <p>Wir erstellen die Inhalte dieser Website mit Sorgfalt. Für die Richtigkeit, Vollständigkeit und Aktualität übernehmen wir im gesetzlich zulässigen Rahmen keine Gewähr. Für Inhalte verlinkter externer Seiten sind ausschließlich deren Betreiber verantwortlich.</p>
        <p>
          <Todo>Formulierung rechtlich prüfen und an die Rechtsform anpassen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Marken">
        <p>Apple, Apple Wallet und iPhone sind Marken der Apple Inc. Google, Google Wallet und Android sind Marken der Google LLC. NXP und NTAG sind Marken der NXP B.V. Die Nennung dient ausschließlich der Beschreibung technischer Kompatibilität.</p>
      </LegalSection>
    </LegalPage>
  );
}
