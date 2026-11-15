'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { ChevronRight, Megaphone, Plus } from 'lucide-react';
import type { CampaignDetailDto, CampaignDto, WalletStatusDto } from '@tapperl/types';
import { Badge, buttonClass, Card, CardHeader, defineCopy, EmptyState, ErrorState, formatDate, formatDateTime, PageHeader, Skeleton, useCopy } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { campaignStatus, campaignType, channelLabel } from '@/lib/labels';
import { DeliveryBanner } from '@/components/marketing/delivery-banner';
import { isRunningType } from '@/components/marketing/labels';

const copy = defineCopy({
  de: {
    title: 'Marketing',
    description: 'Halte Kontakt zu deinen Stammkunden: mit Ankündigungen, Angeboten und Aktionen, die von selbst laufen.',
    create: 'Neue Kampagne',
    errorText: 'Die Kampagnen konnten nicht geladen werden.',
    emptyTitle: 'Noch keine Kampagne',
    emptyText: 'Kündige zum Beispiel ein Angebot an oder lass Tapperl deinen Kunden automatisch zum Geburtstag gratulieren.',
    runningTitle: 'Automatisch laufend',
    runningText: 'Diese Kampagnen arbeiten nach dem Start von selbst, bis du sie pausierst oder beendest.',
    runningEmpty: 'Noch keine automatische Kampagne. Geburtstagsgrüße, Rückgewinnung und Bonus-Stempel-Aktionen erscheinen hier.',
    onceTitle: 'Einmalige Kampagnen',
    onceText: 'Ankündigungen und Angebote, die einmal an eine Zielgruppe gehen.',
    onceEmpty: 'Noch keine einmalige Kampagne.',
    sent: 'versendet',
    sentTest: 'im Testmodus',
    skipped: 'übersprungen',
    failed: 'fehlgeschlagen',
    noSends: 'Noch kein Versand',
    bonusNoSends: 'Aktion auf der Karte, kein Versand',
    scheduledFor: 'Geplant für',
    sentAt: 'Gesendet am',
    endsAt: 'Läuft bis',
    createdAt: 'Angelegt am',
    multiplier: (n: number) => `Stempel zählen ×${n}`,
    open: 'Öffnen',
  },
});

type T = (typeof copy)['de'];

function CampaignRow({ c, t }: { c: CampaignDto; t: T }) {
  const total = c.stats.sent + c.stats.sentTest + c.stats.skipped + c.stats.failed;
  const when = c.status === 'SCHEDULED' && c.scheduledAt ? `${t.scheduledFor} ${formatDateTime(c.scheduledAt)}` : c.sentAt ? `${t.sentAt} ${formatDateTime(c.sentAt)}` : c.endsAt && c.status !== 'ENDED' ? `${t.endsAt} ${formatDate(c.endsAt)}` : `${t.createdAt} ${formatDate(c.createdAt)}`;
  return (
    <li>
      <Link href={`/marketing/${c.id}`} className="flex items-start gap-3 px-5 py-4 hover:bg-sunken/60 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 truncate font-medium text-ink">{c.name}</span>
            <Badge tone={campaignStatus[c.status].tone} dot>
              {campaignStatus[c.status].label}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {campaignType[c.type].label} · {c.channels.map((ch) => channelLabel[ch] ?? ch).join(', ')}
            {c.type === 'BONUS_STAMPS' ? ` · ${t.multiplier(c.config.multiplier)}` : ''}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm tabular">
            {total === 0 ? (
              <span className="text-subtle">{c.type === 'BONUS_STAMPS' ? t.bonusNoSends : t.noSends}</span>
            ) : (
              <>
                {c.stats.sent > 0 ? (
                  <span className="text-success">
                    {c.stats.sent} {t.sent}
                  </span>
                ) : null}
                {c.stats.sentTest > 0 ? (
                  <span className="text-honey">
                    {c.stats.sentTest} {t.sentTest}
                  </span>
                ) : null}
                {c.stats.skipped > 0 ? (
                  <span className="text-muted">
                    {c.stats.skipped} {t.skipped}
                  </span>
                ) : null}
                {c.stats.failed > 0 ? (
                  <span className="text-danger">
                    {c.stats.failed} {t.failed}
                  </span>
                ) : null}
              </>
            )}
            <span className="text-subtle">{when}</span>
          </p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-label={t.open} />
      </Link>
    </li>
  );
}

function Section({ title, text, empty, items, t }: { title: string; text: string; empty: string; items: CampaignDto[]; t: T }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} description={text} className="pb-4" />
      {items.length === 0 ? (
        <p className="border-t border-line px-5 py-6 text-sm text-muted sm:px-6">{empty}</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {items.map((c) => (
            <CampaignRow key={c.id} c={c} t={t} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function MarketingPage() {
  const t = useCopy(copy);
  const { me } = useSession();
  const campaigns = useSWR<CampaignDto[]>('/campaigns');
  const wallet = useSWR<WalletStatusDto>('/wallet/status');
  // Den E-Mail-Versandmodus liefert nur die Detailantwort einer Kampagne.
  const firstId = campaigns.data?.[0]?.id;
  const probe = useSWR<CampaignDetailDto>(firstId ? `/campaigns/${firstId}` : null);

  const createLink = (
    <Link href="/marketing/neu" className={buttonClass({})}>
      <Plus className="size-4" aria-hidden />
      {t.create}
    </Link>
  );
  const running = (campaigns.data ?? []).filter((c) => isRunningType(c.type));
  const once = (campaigns.data ?? []).filter((c) => !isRunningType(c.type));

  return (
    <>
      <PageHeader title={t.title} description={t.description} actions={createLink} />
      <DeliveryBanner className="mb-6" mailMode={probe.data?.mailMode} wallet={wallet.data} walletError={Boolean(wallet.error)} emailFeature={Boolean(me.subscription?.features.emailCampaigns)} />

      {campaigns.error ? (
        <Card>
          <ErrorState description={t.errorText} onRetry={() => void campaigns.mutate()} />
        </Card>
      ) : !campaigns.data ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : campaigns.data.length === 0 ? (
        <Card>
          <EmptyState icon={<Megaphone />} title={t.emptyTitle} description={t.emptyText} action={createLink} />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <Section title={t.runningTitle} text={t.runningText} empty={t.runningEmpty} items={running} t={t} />
          <Section title={t.onceTitle} text={t.onceText} empty={t.onceEmpty} items={once} t={t} />
        </div>
      )}
    </>
  );
}
