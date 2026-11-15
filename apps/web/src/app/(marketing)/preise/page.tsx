import type { Metadata } from 'next';
import Link from 'next/link';
import { TRIAL_PLAN_ID } from '@tably/config';
import { FaqList, pickFaq } from '@/components/marketing/faq';
import { getPlans } from '@/components/marketing/plans';
import { PricingTable } from '@/components/marketing/pricing';
import { StampSide } from '@/components/marketing/stamp';
import { ClosingCta, Container, Eyebrow, Section, SectionHeading, TextLink } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Preise',
  description: 'Drei Tarife für digitale Treuekarten mit NFC-Stempel: Starter, Business und Premium. 14 Tage kostenlos testen, Preise zzgl. MwSt. Der Stempel ist separat erhältlich – Preis auf Anfrage.',
};

export default async function PricingPage() {
  const { plans, trialDays } = await getPlans();
  const trialPlan = plans.find((p) => p.id === TRIAL_PLAN_ID);

  return (
    <>
      <Container className="pb-6 pt-16 text-center sm:pt-24">
        <Eyebrow className="justify-center">Preise</Eyebrow>
        <h1 className="mx-auto mt-5 max-w-3xl font-display text-[2.5rem] leading-[1.06] tracking-[-0.02em] text-ink text-balance sm:text-6xl">Ein fester Preis im Monat. Keine Gebühr pro Stempel.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted text-pretty sm:text-xl">
          {trialDays} Tage kostenlos testen{trialPlan ? `, mit dem Umfang des ${trialPlan.name}-Tarifs` : ''}. Danach wählst du den Tarif, der zu deinem Betrieb passt.
        </p>
      </Container>

      <Container className="pb-20 pt-8 sm:pb-24">
        <PricingTable plans={plans} trialDays={trialDays} trialPlanId={TRIAL_PLAN_ID} />

        <ul className="mx-auto mt-12 grid max-w-4xl gap-x-10 gap-y-3 text-sm leading-relaxed text-muted sm:grid-cols-2">
          <li>Alle Preise in Euro zzgl. der gesetzlichen MwSt. Das Angebot richtet sich an Unternehmen.</li>
          <li>Bei jährlicher Zahlung wird der Jahrespreis im Voraus berechnet.</li>
          <li>Kündigung im Dashboard zum Ende des laufenden Abrechnungszeitraums.</li>
          <li>Wallet-Karten erfordern eine Einrichtung beim jeweiligen Anbieter (Apple bzw. Google).</li>
        </ul>
      </Container>

      <Section tone="surface">
        <Container>
          <div className="grid items-center gap-10 rounded-[2rem] border border-line bg-paper p-6 sm:p-10 md:grid-cols-[auto_minmax(0,1fr)] md:gap-14">
            <div className="mx-auto w-28 sm:w-36">
              <StampSide title="Der Tably-Stempel in der Seitenansicht" />
            </div>
            <div>
              <Eyebrow>Hardware</Eyebrow>
              <h2 className="mt-4 font-display text-3xl leading-tight text-ink sm:text-4xl">Der Stempel ist separat erhältlich.</h2>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
                Die Tarife decken die Software ab. Der NFC-Stempel ist ein eigenes Hardwareprodukt, das wir gerade für die Serienfertigung vorbereiten. Ein Preis steht noch nicht fest – deshalb: <strong className="font-semibold text-ink">Preis auf Anfrage</strong>, Vorbestellung über das Kontaktformular.
              </p>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">Zum Testen brauchst du ihn nicht: Im Dashboard gibt es einen simulierten Stempel.</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-4">
                <Link href="/kontakt?thema=hardware" className="inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 font-medium text-on-brand transition-colors hover:bg-brand-hover">
                  Stempel vorbestellen
                </Link>
                <TextLink href="/hardware">Mehr zum Stempel</TextLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
            <div>
              <SectionHeading eyebrow="Fragen zum Tarif" title="Was du vor dem Start wissen solltest." />
              <TextLink href="/faq" className="mt-7">
                Alle Fragen und Antworten
              </TextLink>
            </div>
            <FaqList items={pickFaq(['test', 'kuendigung', 'preise', 'stempelpreis', 'mehrere'])} />
          </div>
        </Container>
      </Section>
      <ClosingCta />
    </>
  );
}
