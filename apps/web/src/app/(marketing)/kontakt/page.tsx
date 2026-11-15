import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/marketing/contact-form';
import { CONTACT_TOPICS } from '@/components/marketing/site';
import { Container, Eyebrow } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Kontakt',
  description: 'Fragen zu Tably, eine Demo oder den NFC-Stempel vorbestellen: Schreib uns über das Kontaktformular.',
};

const HELP = [
  { title: 'Stempel vorbestellen', text: 'Sag uns, wie viele Standorte und Theken du hast. Den Preis nennen wir dir, sobald er feststeht.' },
  { title: 'Demo & Beratung', text: 'Wir zeigen dir Dashboard, Karte und den Ablauf an der Theke und klären, welche Buchungsrichtlinie passt.' },
  { title: 'Technik & Kasse', text: 'Fragen zur Kassen-Schnittstelle, zu Wallet-Karten oder zur Einrichtung.' },
];

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ thema?: string | string[] }> }) {
  const { thema } = await searchParams;
  const key = Array.isArray(thema) ? thema[0] : thema;
  const initialTopic = CONTACT_TOPICS.find((t) => t.key === key)?.value ?? '';

  return (
    <Container className="py-14 sm:py-24">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
        <div>
          <Eyebrow>Kontakt</Eyebrow>
          <h1 className="mt-5 font-display text-[2.5rem] leading-[1.06] tracking-[-0.02em] text-ink text-balance sm:text-6xl">Schreib uns.</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted text-pretty">Ob Vorbestellung, Demo oder eine Frage, die in den FAQ fehlt: Wir lesen jede Nachricht und antworten per E-Mail.</p>
          <dl className="mt-10 divide-y divide-line border-y border-line">
            {HELP.map((h) => (
              <div key={h.title} className="py-5">
                <dt className="font-semibold text-ink">{h.title}</dt>
                <dd className="mt-1 text-[15px] leading-relaxed text-muted">{h.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-[15px] leading-relaxed text-muted">
            Vielleicht ist deine Frage schon beantwortet:{' '}
            <Link href="/faq" className="font-medium text-brand underline underline-offset-4 hover:no-underline">
              Häufige Fragen
            </Link>
            . Du bist Kund:in eines Betriebs und suchst deine Stempelkarte?{' '}
            <Link href="/karten" prefetch={false} className="font-medium text-brand underline underline-offset-4 hover:no-underline">
              Meine Karten
            </Link>
            .
          </p>
        </div>
        <ContactForm initialTopic={initialTopic} />
      </div>
    </Container>
  );
}
