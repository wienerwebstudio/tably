import type { Metadata } from 'next';
import { FAQ_GROUPS, FaqList } from '@/components/marketing/faq';
import { ClosingCta, Container, PageHero, SecondaryCta } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Häufige Fragen',
  description: 'Braucht der Kunde eine App? Funktioniert es mit jedem Handy? Was kostet der Stempel? Antworten zu NFC-Stempel, Sicherheit, Apple und Google Wallet, Kündigung und Datenschutz.',
};

function slug(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, 'und')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_GROUPS.flatMap((g) => g.items).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.plain } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <PageHero eyebrow="Häufige Fragen" title="Fragen, die an der Theke wirklich gestellt werden." lead="Ehrliche Antworten – auch dort, wo die Antwort „noch nicht“ oder „das hängt von Apple und Google ab“ lautet." />

      <Container className="py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20">
          <nav aria-label="Themen" className="hidden lg:block">
            <ul className="sticky top-28 space-y-1 border-l border-line">
              {FAQ_GROUPS.map((g) => (
                <li key={g.title}>
                  <a href={`#${slug(g.title)}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-[15px] text-muted transition-colors hover:border-brand hover:text-ink">
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-16">
            {FAQ_GROUPS.map((g) => (
              <section key={g.title} id={slug(g.title)} className="scroll-mt-28">
                <h2 className="font-display text-3xl text-ink">{g.title}</h2>
                <FaqList items={g.items} className="mt-6" />
              </section>
            ))}
            <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
              <h2 className="font-display text-2xl text-ink">Deine Frage war nicht dabei?</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-muted">Schreib uns. Wir antworten persönlich und ergänzen diese Seite, wenn die Frage öfter kommt.</p>
              <SecondaryCta href="/kontakt" className="mt-6">
                Zum Kontaktformular
              </SecondaryCta>
            </div>
          </div>
        </div>
      </Container>
      <ClosingCta />
    </>
  );
}
