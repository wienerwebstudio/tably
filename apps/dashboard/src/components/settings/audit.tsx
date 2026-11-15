'use client';
import * as React from 'react';
import useSWR from 'swr';
import { ScrollText } from 'lucide-react';
import type { AuditEntryDto, Page } from '@tably/types';
import { Card, CardHeader, defineCopy, EmptyState, ErrorState, formatDateTime, Pagination, Skeleton, Table, Td, Th, useCopy } from '@tably/ui';
import { auditAction } from '@/lib/labels';

const copy = defineCopy({
  de: {
    title: 'Protokoll',
    description: 'Wer hat wann was geändert? Sicherheitsrelevante Vorgänge in deinem Betrieb.',
    colAction: 'Aktion',
    colActor: 'Wer',
    colTime: 'Wann',
    colIp: 'IP-Adresse',
    emptyTitle: 'Noch keine Einträge',
    emptyText: 'Sobald in deinem Betrieb etwas geändert wird, erscheint es hier.',
    actors: { USER: 'Teammitglied', SUPER_ADMIN: 'Plattformbetreiber', SYSTEM: 'System', CUSTOMER: 'Kunde', API_KEY: 'Kassen-Schnittstelle' } as Record<string, string>,
  },
});

const PAGE_SIZE = 25;

export function AuditSettings() {
  const t = useCopy(copy);
  const [page, setPage] = React.useState(1);
  const audit = useSWR<Page<AuditEntryDto>>(`/organization/audit?page=${page}&pageSize=${PAGE_SIZE}`, { keepPreviousData: true });

  return (
    <Card>
      <CardHeader title={t.title} description={t.description} />
      {audit.error ? (
        <ErrorState onRetry={() => void audit.mutate()} />
      ) : !audit.data ? (
        <div className="flex flex-col gap-3 p-5 sm:p-6">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
      ) : audit.data.items.length === 0 ? (
        <EmptyState icon={<ScrollText />} title={t.emptyTitle} description={t.emptyText} />
      ) : (
        <div className="mt-4 border-t border-line">
          <Table>
            <thead>
              <tr>
                <Th>{t.colAction}</Th>
                <Th>{t.colActor}</Th>
                <Th>{t.colTime}</Th>
                <Th className="hidden sm:table-cell">{t.colIp}</Th>
              </tr>
            </thead>
            <tbody>
              {audit.data.items.map((entry) => (
                <tr key={entry.id}>
                  <Td className="min-w-40 font-medium">{auditAction[entry.action] ?? entry.action}</Td>
                  <Td className="text-muted">{entry.actorName ?? t.actors[entry.actorType] ?? entry.actorType}</Td>
                  <Td className="whitespace-nowrap text-muted tabular">{formatDateTime(entry.createdAt)}</Td>
                  <Td className="hidden whitespace-nowrap font-mono text-xs text-muted sm:table-cell">{entry.ip ?? '–'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={audit.data.page} pageSize={audit.data.pageSize} total={audit.data.total} onPage={setPage} />
        </div>
      )}
    </Card>
  );
}
