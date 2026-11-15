import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalAddress, LegalPage, LegalSection, Todo } from '@/components/marketing/legal';

export const metadata: Metadata = {
  title: 'Datenschutzhinweise',
  description: 'Welche personenbezogenen Daten Tapperl auf der Website, im Händlerkonto und in der digitalen Stempelkarte verarbeitet – und welche Rechte du hast (Entwurf).',
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Datenschutzhinweise"
      intro="Diese Hinweise beschreiben, welche personenbezogenen Daten bei der Nutzung der Website, des Händlerkontos und der digitalen Stempelkarte verarbeitet werden."
      updated={
        <>
          Stand: <Todo>Datum</Todo>.
        </>
      }
    >
      <LegalSection title="1. Verantwortlicher">
        <LegalAddress>
          <Todo>Firmenname mit Rechtsform</Todo>
          <br />
          <Todo>Anschrift</Todo>
          <br />
          E-Mail: <Todo>E-Mail-Adresse für Datenschutzanfragen</Todo>
        </LegalAddress>
        <p>
          Datenschutzbeauftragte:r: <Todo>Name und Kontaktdaten – oder Hinweis, dass keine Benennungspflicht besteht</Todo>
        </p>
      </LegalSection>

      <LegalSection title="2. Zwei Rollen: Wer ist wofür verantwortlich?" id="rollen">
        <p>Tapperl ist eine Plattform, über die Betriebe („Händler“) ihren Kund:innen digitale Stempelkarten anbieten. Daraus ergeben sich zwei Rollen:</p>
        <ul>
          <li>
            <strong>Website und Händlerkonten:</strong> Für die Daten von Besucher:innen dieser Website und von Personen, die ein Händlerkonto anlegen oder nutzen, ist der oben genannte Betreiber Verantwortlicher.
          </li>
          <li>
            <strong>Stempelkarten von Endkund:innen:</strong> Für die Daten der Kund:innen eines Händlers ist in der Regel der jeweilige Händler Verantwortlicher. Der Betreiber verarbeitet diese Daten in dessen Auftrag (Art. 28 DSGVO).
          </li>
        </ul>
        <p>
          <Todo>Rollenverteilung rechtlich bestätigen; Vertrag zur Auftragsverarbeitung (AVV) bereitstellen und hier verlinken</Todo>
        </p>
      </LegalSection>

      <LegalSection title="3. Besuch dieser Website">
        <h3>Server-Protokolle</h3>
        <p>Beim Aufruf der Website verarbeitet der Server technisch notwendige Daten: IP-Adresse, Zeitpunkt, aufgerufene Adresse, Statuscode, Browserkennung. Sie dienen der Auslieferung der Seiten, der Sicherheit und der Fehleranalyse (Art. 6 Abs. 1 lit. f DSGVO).</p>
        <p>
          Speicherdauer der Protokolle: <Todo>Frist, z. B. Anzahl Tage</Todo>
        </p>
        <h3>Keine Tracking-Cookies, keine Analyse durch Dritte</h3>
        <p>Auf dieser Website setzen wir keine Tracking- oder Werbe-Cookies ein und binden keine Analyse-, Werbe- oder Social-Media-Dienste Dritter ein. Schriften werden von unserem eigenen Server ausgeliefert. Ein Cookie-Banner ist deshalb nicht erforderlich.</p>
        <h3>Kontaktformular</h3>
        <p>Wenn du uns über das Kontaktformular schreibst, verarbeiten wir deinen Namen, deine E-Mail-Adresse, optional Betrieb und Thema sowie deine Nachricht, um die Anfrage zu beantworten (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Zum Schutz vor Missbrauch wird die Zahl der Anfragen je IP-Adresse kurzzeitig begrenzt.</p>
        <p>
          Speicherdauer von Anfragen: <Todo>Frist</Todo>
        </p>
      </LegalSection>

      <LegalSection title="4. Händlerkonto (Dashboard)" id="haendler">
        <p>Wenn du als Betrieb ein Konto anlegst, verarbeiten wir:</p>
        <ul>
          <li>Zugangsdaten: E-Mail-Adresse, Name, Passwort (ausschließlich als Hash gespeichert)</li>
          <li>Angaben zum Betrieb: Name, Branche, Standorte, Kontaktdaten, Kartengestaltung einschließlich hochgeladener Logos</li>
          <li>Teammitglieder und ihre Rollen</li>
          <li>Vertrags- und Abrechnungsdaten: gewählter Tarif, Abrechnungszeitraum, Status der Zahlung</li>
          <li>Sitzungsdaten: ein technisch notwendiges Cookie für die Anmeldung sowie IP-Adresse und Browserkennung der Sitzung</li>
          <li>Protokolle sicherheitsrelevanter Aktionen im Konto (z. B. Änderungen an Team, Geräten und Buchungen)</li>
        </ul>
        <p>Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) sowie unser berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).</p>
        <p>
          Zahlungsabwicklung: <Todo>Zahlungsdienstleister mit Anschrift nennen, übermittelte Daten und Rechtsgrundlage beschreiben; vollständige Zahlungsdaten werden nicht auf den Servern der Plattform gespeichert – prüfen und bestätigen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="5. Digitale Stempelkarte (Endkund:innen)" id="karte">
        <p>Wenn du bei einem Betrieb eine Stempelkarte anlegst, werden folgende Daten verarbeitet:</p>
        <ul>
          <li>
            <strong>Vorname</strong> (erforderlich), optional Nachname
          </li>
          <li>
            <strong>E-Mail-Adresse</strong> (freiwillig) – um die Karte auf einem anderen Gerät wiederherzustellen und, nur mit Einwilligung, für Nachrichten des Betriebs
          </li>
          <li>
            <strong>Geburtstag</strong> (freiwillig) – für Geburtstagsaktionen des Betriebs
          </li>
          <li>
            <strong>Stempelhistorie</strong>: gesammelte Stempel, eingelöste Prämien, Korrekturen, jeweils mit Zeitpunkt, Standort und verwendetem Stempel
          </li>
          <li>
            <strong>Einwilligungen</strong>: welche Einwilligung wann erteilt oder widerrufen wurde, einschließlich der Version der Datenschutzhinweise
          </li>
          <li>
            <strong>Technische Daten beim Stempeln</strong>: IP-Adresse und Browserkennung, um Missbrauch zu erkennen und zu begrenzen
          </li>
        </ul>
        <h3>Ein Cookie zur Wiedererkennung der Karte</h3>
        <p>
          Damit dein Browser deine Karte beim nächsten Besuch wiederfindet, wird ein einzelnes, technisch notwendiges Cookie gesetzt (<code>tapperl_customer</code>). Es enthält eine zufällige Kennung und keine persönlichen Angaben; auf dem Server wird nur ein Hash dieser Kennung gespeichert. Das Cookie wird nicht zum Tracking verwendet und nicht mit Dritten geteilt.
        </p>
        <p>
          Laufzeit des Cookies: <Todo>Laufzeit bestätigen (derzeit technisch auf 400 Tage eingestellt)</Todo>
        </p>
        <h3>Nachrichten des Betriebs</h3>
        <p>Angebote oder Erinnerungen per E-Mail oder über die Wallet-Karte erhältst du nur, wenn du ausdrücklich eingewilligt hast (Art. 6 Abs. 1 lit. a DSGVO). Die Einwilligung kannst du jederzeit in deiner Karte oder über den Abmeldelink widerrufen.</p>
        <h3>Wallet-Karten</h3>
        <p>Wenn du deine Karte zusätzlich in Apple Wallet oder Google Wallet ablegst, werden die auf der Karte sichtbaren Angaben (Name des Betriebs, Kartentitel, Stempelstand) an den jeweiligen Anbieter übermittelt, damit die Karte dort angezeigt und aktualisiert werden kann. Das geschieht nur auf deine eigene Veranlassung.</p>
        <p>
          <Todo>Empfänger (Apple, Google) mit Anschrift, Rechtsgrundlage und Hinweise zu Übermittlungen in Drittländer ergänzen</Todo>
        </p>
        <h3>Rechtsgrundlage und Verantwortlicher</h3>
        <p>
          Verantwortlich ist in der Regel der Betrieb, bei dem du die Karte führst; Rechtsgrundlage ist die Durchführung des Treueprogramms (Art. 6 Abs. 1 lit. b DSGVO) und für werbliche Nachrichten deine Einwilligung. <Todo>Rechtsgrundlagen prüfen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="6. Auskunft, Export und Löschung direkt in der Karte" id="rechte-karte">
        <p>
          Als Endkund:in kannst du unter <Link href="/karten" prefetch={false}>Meine Karten</Link> in jeder Karte
        </p>
        <ul>
          <li>deine gespeicherten Daten einsehen und berichtigen,</li>
          <li>eine Kopie deiner Daten herunterladen (Auskunft und Datenübertragbarkeit),</li>
          <li>Einwilligungen widerrufen und</li>
          <li>deine Karte samt personenbezogener Daten löschen.</li>
        </ul>
        <p>Bei einer Löschung werden die personenbezogenen Angaben entfernt. Buchungssätze können ohne Personenbezug erhalten bleiben, soweit der Betrieb sie für seine Auswertung oder aus gesetzlichen Gründen benötigt.</p>
        <p>
          <Todo>Umfang der Anonymisierung und Aufbewahrungsfristen rechtlich prüfen und konkret benennen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="7. Empfänger und Auftragsverarbeiter">
        <p>Wir setzen Dienstleister ein, die Daten in unserem Auftrag verarbeiten. Unser Ziel ist ein Hosting ausschließlich in der Europäischen Union.</p>
        <ul>
          <li>
            Hosting und Datenbank: <Todo>Anbieter, Anschrift, Serverstandort</Todo>
          </li>
          <li>
            E-Mail-Versand: <Todo>Anbieter, Anschrift, Serverstandort</Todo>
          </li>
          <li>
            Zahlungsabwicklung: <Todo>Anbieter, Anschrift</Todo>
          </li>
          <li>
            Weitere: <Todo>vollständige Liste der Auftragsverarbeiter</Todo>
          </li>
        </ul>
        <p>
          Übermittlungen in Drittländer: <Todo>angeben, ob und auf welcher Grundlage (z. B. Angemessenheitsbeschluss, Standardvertragsklauseln)</Todo>
        </p>
      </LegalSection>

      <LegalSection title="8. Speicherdauer">
        <p>Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.</p>
        <p>
          <Todo>Konkrete Fristen je Datenkategorie: Händlerkonto nach Vertragsende, Abrechnungsdaten, Protokolle, inaktive Kundenkarten, Kontaktanfragen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="9. Deine Rechte">
        <p>Du hast nach der DSGVO das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Erteilte Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen.</p>
        <p>Betrifft dein Anliegen eine Stempelkarte, kannst du dich auch direkt an den Betrieb wenden, bei dem du die Karte führst.</p>
        <p>
          Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständige Behörde: <Todo>zuständige Aufsichtsbehörde nach Sitz des Betreibers</Todo>
        </p>
      </LegalSection>

      <LegalSection title="10. Sicherheit">
        <p>Die Übertragung erfolgt verschlüsselt (TLS). Passwörter, Sitzungs- und Kartenkennungen werden nicht im Klartext gespeichert. Jeder Tap eines Stempels wird kryptografisch geprüft und ist nur einmal gültig.</p>
        <p>
          <Todo>Technische und organisatorische Maßnahmen (TOM) dokumentieren und im AVV beifügen</Todo>
        </p>
      </LegalSection>

      <LegalSection title="11. Änderungen">
        <p>Wir passen diese Hinweise an, wenn sich die Plattform oder die Rechtslage ändert. Die jeweils aktuelle Fassung findest du auf dieser Seite.</p>
      </LegalSection>
    </LegalPage>
  );
}
