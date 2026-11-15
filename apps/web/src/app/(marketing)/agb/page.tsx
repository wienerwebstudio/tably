import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LegalSection, Todo } from '@/components/marketing/legal';

export const metadata: Metadata = {
  title: 'Allgemeine Geschäftsbedingungen',
  description: 'Allgemeine Geschäftsbedingungen für die Nutzung der Tably-Plattform durch Unternehmen (Entwurf).',
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen"
      intro="Gerüst der Bedingungen für die Nutzung der Tably-Plattform durch Unternehmen."
      updated={
        <>
          Stand: <Todo>Datum</Todo>.
        </>
      }
    >
      <LegalSection title="§ 1 Geltungsbereich und Anbieter">
        <p>
          Diese Bedingungen gelten für Verträge über die Nutzung der Software-Plattform „Tably“ zwischen <Todo>Firmenname mit Rechtsform, Anschrift</Todo> („Anbieter“) und dem Kunden.
        </p>
        <p>Das Angebot richtet sich ausschließlich an Unternehmer im Sinne von § 14 BGB. Abweichende Bedingungen des Kunden gelten nur, wenn der Anbieter ihnen ausdrücklich zustimmt.</p>
        <p>
          <Todo>Für Kunden in Österreich und der Schweiz: anwendbare Regelungen prüfen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 2 Leistungen">
        <p>Der Anbieter stellt eine über das Internet nutzbare Plattform bereit, mit der der Kunde digitale Treuekarten gestalten, an seine Kund:innen ausgeben und Stempel sowie Prämien verwalten kann. Der Umfang richtet sich nach dem gewählten Tarif und der Leistungsbeschreibung auf der <Link href="/preise">Preisseite</Link> zum Zeitpunkt des Vertragsschlusses.</p>
        <p>Wallet-Karten (Apple Wallet, Google Wallet) setzen eine Einrichtung beim jeweiligen Anbieter voraus. Der Anbieter schuldet nicht, dass Dritte diese Einrichtung oder Freigaben erteilen oder aufrechterhalten.</p>
        <p>
          Verfügbarkeit und Wartungsfenster: <Todo>Zusage zur Verfügbarkeit, falls eine gegeben werden soll; Regelung zu Wartung und Support</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 3 NFC-Stempel (Hardware)">
        <p>Der NFC-Stempel ist nicht Bestandteil der Software-Tarife. Erwerb oder Überlassung der Hardware werden gesondert vereinbart.</p>
        <p>
          <Todo>Bedingungen für die Hardware: Kauf oder Miete, Preis, Lieferung, Gefahrübergang, Gewährleistung, Ersatz bei Verlust oder Defekt</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 4 Vertragsschluss und Testphase">
        <p>Der Vertrag kommt mit der Registrierung und der Bestätigung durch den Anbieter zustande. Neue Konten können die Plattform für eine Testphase von 14 Tagen kostenlos nutzen. Nach Ablauf der Testphase ist für die weitere Nutzung ein kostenpflichtiger Tarif erforderlich.</p>
        <p>
          <Todo>Ablauf nach Ende der Testphase (Einschränkung, Aufbewahrung und Löschung der Daten) verbindlich regeln</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 5 Preise und Zahlung">
        <p>Es gelten die bei Vertragsschluss auf der Preisseite genannten Preise. Alle Preise verstehen sich zuzüglich der gesetzlichen Umsatzsteuer. Die Abrechnung erfolgt je nach Wahl monatlich oder jährlich im Voraus.</p>
        <p>
          <Todo>Zahlungsarten, Fälligkeit, Zahlungsdienstleister, Folgen des Zahlungsverzugs (einschließlich Kulanzfrist und Einschränkung des Kontos), Regelung zu Preisänderungen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 6 Laufzeit und Kündigung">
        <p>Der Vertrag läuft für den gewählten Abrechnungszeitraum und verlängert sich jeweils um denselben Zeitraum, wenn er nicht gekündigt wird. Die Kündigung ist im Dashboard möglich und wird zum Ende des laufenden Abrechnungszeitraums wirksam. Das Recht zur Kündigung aus wichtigem Grund bleibt unberührt.</p>
        <p>
          <Todo>Kündigungsfrist, Form, Datenexport und Löschung nach Vertragsende festlegen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 7 Pflichten des Kunden">
        <ul>
          <li>Der Kunde hält seine Zugangsdaten geheim und vergibt Rollen im Team mit Bedacht.</li>
          <li>Der Kunde ist für die Ausgestaltung seines Treueprogramms, die Prämien und deren Einlösung gegenüber seinen Kund:innen selbst verantwortlich.</li>
          <li>Werbliche Nachrichten versendet der Kunde nur an Personen, die wirksam eingewilligt haben.</li>
          <li>Der Kunde meldet verlorene oder gestohlene Stempel unverzüglich bzw. sperrt sie im Dashboard.</li>
        </ul>
        <p>
          <Todo>Weitere Pflichten und unzulässige Nutzungen ergänzen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 8 Datenschutz und Auftragsverarbeitung">
        <p>
          Soweit der Anbieter personenbezogene Daten der Kund:innen des Kunden verarbeitet, geschieht dies im Auftrag des Kunden. Die Parteien schließen hierzu einen Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO. Einzelheiten zur Verarbeitung stehen in den <Link href="/datenschutz">Datenschutzhinweisen</Link>.
        </p>
        <p>
          <Todo>AVV bereitstellen und einbeziehen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 9 Grenzen der Stempelprüfung">
        <p>Die Plattform prüft jeden Tap eines Stempels kryptografisch und nimmt ihn nur einmal an. Ein Tap belegt nicht, dass ein Kauf stattgefunden hat. Der Kunde wählt die für sein Geschäft passende Buchungsrichtlinie und trägt das Risiko missbräuchlich erlangter Stempel, soweit es nicht auf einem vom Anbieter zu vertretenden Fehler der Plattform beruht.</p>
        <p>
          <Todo>Risikoverteilung rechtlich prüfen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 10 Gewährleistung und Haftung">
        <p>
          <Todo>Regelungen zu Mängeln, Haftungsumfang und Haftungsbegrenzung durch eine Rechtsanwältin oder einen Rechtsanwalt formulieren lassen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 11 Änderungen dieser Bedingungen">
        <p>
          <Todo>Verfahren für Änderungen (Ankündigungsfrist, Widerspruchsrecht) festlegen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="§ 12 Schlussbestimmungen">
        <p>
          Anwendbares Recht: <Todo>z. B. Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts</Todo>
          <br />
          Gerichtsstand: <Todo>Ort</Todo>
        </p>
        <p>Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
      </LegalSection>
    </LegalPage>
  );
}
