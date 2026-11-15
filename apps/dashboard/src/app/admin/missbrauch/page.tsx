'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ShieldCheck } from 'lucide-react';
import { Badge, Card, CardHeader, defineCopy, EmptyState, formatDateTime, formatNumber, PageHeader, Pagination, Skeleton, Table, Td, Th, useCopy } from '@tapperl/ui';
import { flagReason, txSource, txType } from '@/lib/labels';
import { LoadError, pagedKey } from '@/components/admin/shared';
import type { AdminAbuse } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    title: 'Missbrauch',
    description: 'Auffällige Buchungen auf der gesamten Plattform.',
    byOrgTitle: 'Betriebe mit den meisten Auffälligkeiten',
    byOrgDescription: 'Stempel-Buchungen der letzten 30 Tage.',
    byOrgEmpty: 'In den letzten 30 Tagen gab es keine auffälligen Stempel-Buchungen.',
    colOrg: 'Betrieb',
    colFlagged: 'Auffällig',
    colTotal: 'Buchungen gesamt',
    colShare: 'Anteil',
    listTitle: 'Auffällige Buchungen',
    colTime: 'Zeitpunkt',
    colType: 'Art',
    colSource: 'Quelle',
    colAmount: 'Menge',
    colReason: 'Grund',
    emptyTitle: 'Keine auffälligen Buchungen',
    emptyText: 'Bisher wurde auf der Plattform keine Buchung als auffällig markiert.',
    unknownOrg: 'Unbekannter Betrieb',
  },
});

export default function AdminAbusePage() {
  const t = useCopy(copy);
  const [page, setPage] = React.useState(1);
  const abuse = useSWR<AdminAbuse>(pagedKey('/admin/abuse', { page, pageSize: 25 }), { keepPreviousData: true });

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {abuse.error ? (
        <Card><LoadError error={abuse.error} onRetry={() => void abuse.mutate()} /></Card>
      ) : !abuse.data ? (
        <div className="flex flex-col gap-6"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t.byOrgTitle} description={t.byOrgDescription} />
            {abuse.data.byOrganization.length === 0 ? (
              <p className="p-5 text-sm text-muted sm:px-6">{t.byOrgEmpty}</p>
            ) : (
              <div className="mt-4 border-t border-line">
                <Table>
                  <thead><tr><Th>{t.colOrg}</Th><Th className="text-right">{t.colFlagged}</Th><Th className="text-right">{t.colTotal}</Th><Th className="text-right">{t.colShare}</Th></tr></thead>
                  <tbody>
                    {abuse.data.byOrganization.map((row) => (
                      <tr key={row.organizationId}>
                        <Td className="min-w-44"><Link href={`/admin/betriebe/${row.organizationId}`} className="font-medium hover:underline">{row.name}</Link></Td>
                        <Td className="text-right font-medium tabular">{formatNumber(row.flagged)}</Td>
                        <Td className="text-right tabular text-muted">{formatNumber(row.total)}</Td>
                        <Td className="text-right tabular text-muted">{row.total > 0 ? `${((row.flagged / row.total) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %` : '–'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title={`${t.listTitle} (${formatNumber(abuse.data.total)})`} />
            {abuse.data.items.length === 0 ? (
              <EmptyState icon={<ShieldCheck />} title={t.emptyTitle} description={t.emptyText} />
            ) : (
              <div className="mt-4 border-t border-line">
                <Table>
                  <thead><tr><Th>{t.colTime}</Th><Th>{t.colOrg}</Th><Th>{t.colType}</Th><Th className="hidden md:table-cell">{t.colSource}</Th><Th className="text-right">{t.colAmount}</Th><Th>{t.colReason}</Th></tr></thead>
                  <tbody>
                    {abuse.data.items.map((tx) => (
                      <tr key={tx.id}>
                        <Td className="whitespace-nowrap text-muted tabular">{formatDateTime(tx.createdAt)}</Td>
                        <Td className="min-w-40"><Link href={`/admin/betriebe/${tx.organizationId}`} className="hover:underline">{tx.organizationName ?? t.unknownOrg}</Link></Td>
                        <Td><Badge tone={txType[tx.type]?.tone}>{txType[tx.type]?.label ?? tx.type}</Badge></Td>
                        <Td className="hidden whitespace-nowrap text-muted md:table-cell">{txSource[tx.source] ?? tx.source}</Td>
                        <Td className="text-right font-medium tabular">{tx.amount > 0 ? '+' : ''}{tx.amount}</Td>
                        <Td className="min-w-44">{tx.flagReason ? (flagReason[tx.flagReason] ?? tx.flagReason) : '–'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Pagination page={abuse.data.page} pageSize={abuse.data.pageSize} total={abuse.data.total} onPage={setPage} />
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
