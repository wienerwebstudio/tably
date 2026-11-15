'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ScrollText } from 'lucide-react';
import type { AuditEntryDto, Page } from '@tapperl/types';
import { Card, defineCopy, EmptyState, formatDateTime, PageHeader, Pagination, Skeleton, Table, Td, Th, useCopy } from '@tapperl/ui';
import { actorLabel, auditLabel, LoadError, pagedKey, SearchField } from '@/components/admin/shared';

const copy = defineCopy({
  de: {
    title: 'Protokoll',
    description: 'Alle sicherheitsrelevanten Vorgänge der Plattform.',
    filter: 'Nach Aktion filtern',
    filterPlaceholder: 'z. B. billing, auth.login, admin.',
    colAction: 'Aktion',
    colActor: 'Akteur',
    colOrg: 'Betrieb',
    colTarget: 'Ziel',
    colTime: 'Zeitpunkt',
    colIp: 'IP-Adresse',
    openOrg: 'Betrieb öffnen',
    emptyTitle: 'Keine Einträge',
    emptyFiltered: 'Für diesen Filter gibt es keine Einträge. Gefiltert wird nach dem technischen Namen der Aktion.',
    emptyAll: 'Das Protokoll ist noch leer.',
  },
});

export default function AdminAuditPage() {
  const t = useCopy(copy);
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const list = useSWR<Page<AuditEntryDto>>(pagedKey('/admin/audit', { q, page, pageSize: 50 }), { keepPreviousData: true });
  const search = React.useCallback((value: string) => (setQ(value), setPage(1)), []);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Card>
        <div className="p-4 sm:px-6"><SearchField onSearch={search} label={t.filter} placeholder={t.filterPlaceholder} /></div>
        {list.error ? (
          <LoadError error={list.error} onRetry={() => void list.mutate()} />
        ) : !list.data ? (
          <div className="flex flex-col gap-3 border-t border-line p-5 sm:p-6">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<ScrollText />} title={t.emptyTitle} description={q ? t.emptyFiltered : t.emptyAll} className="border-t border-line" />
        ) : (
          <div className="border-t border-line">
            <Table>
              <thead>
                <tr>
                  <Th>{t.colTime}</Th>
                  <Th>{t.colAction}</Th>
                  <Th>{t.colActor}</Th>
                  <Th>{t.colOrg}</Th>
                  <Th className="hidden lg:table-cell">{t.colTarget}</Th>
                  <Th className="hidden md:table-cell">{t.colIp}</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <Td className="whitespace-nowrap text-muted tabular">{formatDateTime(entry.createdAt)}</Td>
                    <Td className="min-w-48">
                      <p className="font-medium">{auditLabel(entry.action)}</p>
                      <p className="font-mono text-xs text-muted">{entry.action}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{actorLabel[entry.actorType] ?? entry.actorType}</Td>
                    <Td className="whitespace-nowrap">{entry.organizationId ? <Link href={`/admin/betriebe/${entry.organizationId}`} className="text-brand hover:underline">{t.openOrg}</Link> : <span className="text-muted">–</span>}</Td>
                    <Td className="hidden whitespace-nowrap text-muted lg:table-cell">{entry.targetType ?? '–'}</Td>
                    <Td className="hidden whitespace-nowrap font-mono text-xs text-muted md:table-cell">{entry.ip ?? '–'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </div>
        )}
      </Card>
    </>
  );
}
