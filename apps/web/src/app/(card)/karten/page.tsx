'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { CreditCard } from 'lucide-react';
import type { MyCardDto } from '@tably/types';
import { defineCopy, EmptyState, ErrorState, LoyaltyCard, Skeleton, useCopy } from '@tably/ui';

const copy = defineCopy({
  de: {
    title: 'Meine Karten',
    emptyTitle: 'Auf diesem Gerät sind noch keine Karten',
    emptyText: 'Deine Treuekarten erscheinen hier, sobald du dich in einem Geschäft anmeldest. Hast du schon eine Karte? Öffne sie über den Link in deiner Wallet-Karte oder über „Karte wiederfinden“ auf der Anmeldeseite des Geschäfts.',
  },
});

export default function MyCardsPage() {
  const t = useCopy(copy);
  const { data, error, isLoading, mutate } = useSWR<MyCardDto[]>('/public/cards');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl tracking-tight">{t.title}</h1>
      {error ? (
        <ErrorState onRetry={() => void mutate()} />
      ) : isLoading || !data ? (
        <Skeleton className="h-56 rounded-[28px]" />
      ) : data.length === 0 ? (
        <EmptyState icon={<CreditCard />} title={t.emptyTitle} description={t.emptyText} />
      ) : (
        <ul className="flex flex-col gap-5">
          {data.map((card) => (
            <li key={card.id}>
              <Link href={`/karte/${card.id}`} className="block rounded-[28px] transition-transform active:scale-[0.99]">
                <LoyaltyCard
                  compact
                  data={{ organizationName: card.organizationName, cardTitle: card.cardTitle, stampsRequired: card.stampsRequired, balance: card.balance, stampIcon: card.stampIcon, backgroundColor: card.design.backgroundColor, textColor: card.design.textColor, accentColor: card.design.accentColor, logoUrl: card.logoUrl }}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
