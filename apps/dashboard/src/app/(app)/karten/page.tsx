'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { CreditCard, Plus } from 'lucide-react';
import type { ProgramDto } from '@tapperl/types';
import { Badge, buttonClass, Card, defineCopy, EmptyState, ErrorState, LoyaltyCard, PageHeader, Skeleton, useCopy } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { policyLabel, programStatus } from '@/lib/labels';
import { toCardData } from '@/components/programs/previews';

const copy = defineCopy({
  de: {
    title: 'Treuekarten',
    description: 'Gestalte deine digitalen Kundenkarten und lege fest, wie Stempel vergeben werden.',
    create: 'Neue Karte',
    emptyTitle: 'Noch keine Treuekarte',
    emptyText: 'Lege deine erste Karte an – Farben, Stempelzahl und Prämie bestimmst du selbst.',
    cards: (n: number) => `${n.toLocaleString('de-DE')} ${n === 1 ? 'Karte' : 'Karten'} ausgegeben`,
    devices: (n: number) => `${n} ${n === 1 ? 'Stempel' : 'Stempel'} zugeordnet`,
    edit: 'Bearbeiten',
  },
});

export default function ProgramsPage() {
  const t = useCopy(copy);
  const { can } = useSession();
  const { data, error, isLoading, mutate } = useSWR<ProgramDto[]>('/programs');
  const create = can('programs.manage') ? (
    <Link href="/karten/neu" className={buttonClass({})}><Plus className="size-4" aria-hidden /> {t.create}</Link>
  ) : undefined;
  return (
    <>
      <PageHeader title={t.title} description={t.description} actions={create} />
      {error ? (
        <Card><ErrorState onRetry={() => void mutate()} /></Card>
      ) : isLoading || !data ? (
        <div className="grid gap-6 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
      ) : data.length === 0 ? (
        <Card><EmptyState icon={<CreditCard />} title={t.emptyTitle} description={t.emptyText} action={create} /></Card>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {data.map((p) => (
            <li key={p.id}>
              <Card className="flex h-full flex-col overflow-hidden">
                <div className="bg-sunken p-6">
                  <LoyaltyCard compact className="mx-auto max-w-sm" data={toCardData({ organizationName: p.preview.organization.name, cardTitle: p.cardTitle, stampsRequired: p.stampsRequired, stampIcon: p.stampIcon, rewardName: p.rewards[0]?.name ?? '', design: p.design, logoUrl: p.preview.logoUrl }, Math.min(3, p.stampsRequired))} />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold">{p.name}</h2>
                    <Badge tone={programStatus[p.status].tone} dot>{programStatus[p.status].label}</Badge>
                  </div>
                  <p className="text-sm text-muted">{t.cards(p.cardCount)} · {t.devices(p.deviceCount)} · Buchung: {policyLabel[p.bookingPolicy].label}</p>
                  <Link href={`/karten/${p.id}`} className={buttonClass({ variant: 'outline', className: 'mt-auto self-start' })}>{can('programs.manage') ? t.edit : 'Ansehen'}</Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
