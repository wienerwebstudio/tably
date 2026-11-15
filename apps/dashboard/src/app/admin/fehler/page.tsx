'use client';
import * as React from 'react';
import useSWR from 'swr';
import { CheckCircle2 } from 'lucide-react';
import type { Page } from '@tapperl/types';
import { Badge, Card, defineCopy, EmptyState, formatDateTime, PageHeader, Pagination, Skeleton, useCopy } from '@tapperl/ui';
import { LoadError, pagedKey } from '@/components/admin/shared';
import type { AdminErrorRow } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    title: 'Fehler',
    description: 'Technisches Fehlerprotokoll der API und der Hintergrundprozesse.',
    emptyTitle: 'Keine Fehler protokolliert',
    emptyText: 'Bisher ist kein technischer Fehler aufgetreten.',
    stack: 'Stacktrace',
    context: 'Kontext',
    noDetails: 'Zu diesem Fehler liegen keine weiteren Details vor.',
  },
});

export default function AdminErrorsPage() {
  const t = useCopy(copy);
  const [page, setPage] = React.useState(1);
  const list = useSWR<Page<AdminErrorRow>>(pagedKey('/admin/errors', { page, pageSize: 25 }), { keepPreviousData: true });

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Card>
        {list.error ? (
          <LoadError error={list.error} onRetry={() => void list.mutate()} />
        ) : !list.data ? (
          <div className="flex flex-col gap-3 p-5 sm:p-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<CheckCircle2 />} title={t.emptyTitle} description={t.emptyText} />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {list.data.items.map((err) => (
                <li key={err.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-col gap-1 px-5 py-3.5 text-sm hover:bg-sunken/50 sm:flex-row sm:items-start sm:gap-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                      <span className="shrink-0 whitespace-nowrap text-muted tabular sm:w-36">{formatDateTime(err.createdAt)}</span>
                      <Badge className="shrink-0 self-start font-mono">{err.source}</Badge>
                      <span className="min-w-0 flex-1 break-words font-medium text-ink group-open:whitespace-pre-wrap">{err.message}</span>
                    </summary>
                    <div className="flex flex-col gap-3 bg-sunken/50 px-5 pb-4 pt-1 sm:px-6">
                      {err.stack ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-subtle">{t.stack}</p>
                          <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-sunken p-3 font-mono text-xs leading-relaxed text-ink" tabIndex={0}>{err.stack}</pre>
                        </div>
                      ) : null}
                      {err.context ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-subtle">{t.context}</p>
                          <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-sunken p-3 font-mono text-xs leading-relaxed text-ink" tabIndex={0}>{JSON.stringify(err.context, null, 2)}</pre>
                        </div>
                      ) : null}
                      {!err.stack && !err.context ? <p className="text-sm text-muted">{t.noDetails}</p> : null}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
