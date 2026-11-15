'use client';
import * as React from 'react';
import useSWR from 'swr';
import { Inbox } from 'lucide-react';
import { api, Badge, Button, Card, defineCopy, EmptyState, errorMessage, formatDateTime, PageHeader, Segmented, Skeleton, useCopy, useToast } from '@tapperl/ui';
import { LoadError } from '@/components/admin/shared';
import type { AdminContactRequest } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    title: 'Kontaktanfragen',
    description: 'Nachrichten aus dem Kontaktformular der Website (die letzten 100).',
    filter: 'Anzeige',
    open: 'Offen',
    all: 'Alle',
    done: 'Erledigt',
    doneAt: (when: string) => `Erledigt am ${when}`,
    markDone: 'Als erledigt markieren',
    marked: 'Anfrage als erledigt markiert.',
    reply: 'Per E-Mail antworten',
    emptyOpenTitle: 'Keine offenen Anfragen',
    emptyOpenText: 'Alle Anfragen sind bearbeitet.',
    emptyAllTitle: 'Noch keine Anfragen',
    emptyAllText: 'Sobald jemand das Kontaktformular nutzt, erscheint die Nachricht hier.',
    noTopic: 'Ohne Betreff',
  },
});

export default function AdminContactRequestsPage() {
  const t = useCopy(copy);
  const toast = useToast();
  const list = useSWR<AdminContactRequest[]>('/admin/contact-requests');
  const [filter, setFilter] = React.useState<'open' | 'all'>('open');
  const [pending, setPending] = React.useState<string | null>(null);

  const markDone = async (id: string) => {
    setPending(id);
    try {
      await api(`/admin/contact-requests/${id}`, { method: 'PATCH' });
      await list.mutate();
      toast.success(t.marked);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  const items = list.data?.filter((r) => filter === 'all' || !r.handledAt) ?? [];
  const openCount = list.data?.filter((r) => !r.handledAt).length ?? 0;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<Segmented label={t.filter} value={filter} onChange={setFilter} options={[{ value: 'open', label: `${t.open}${list.data ? ` (${openCount})` : ''}` }, { value: 'all', label: t.all }]} />}
      />
      {list.error ? (
        <Card><LoadError error={list.error} onRetry={() => void list.mutate()} /></Card>
      ) : !list.data ? (
        <div className="flex flex-col gap-4">{[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<Inbox />} title={list.data.length === 0 ? t.emptyAllTitle : t.emptyOpenTitle} description={list.data.length === 0 ? t.emptyAllText : t.emptyOpenText} /></Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((r) => (
            <li key={r.id}>
              <Card className="p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                      <span className="break-words">{r.topic ?? t.noTopic}</span>
                      {r.handledAt ? <Badge tone="success">{t.done}</Badge> : <Badge tone="warn">{t.open}</Badge>}
                    </p>
                    <p className="mt-1 break-words text-sm text-muted">
                      {r.name}{r.company ? ` · ${r.company}` : ''} · <a href={`mailto:${r.email}`} className="break-all text-brand hover:underline">{r.email}</a>
                    </p>
                    <p className="text-sm text-muted tabular">{formatDateTime(r.createdAt)}{r.handledAt ? ` · ${t.doneAt(formatDateTime(r.handledAt))}` : ''}</p>
                  </div>
                  {!r.handledAt ? <Button variant="outline" size="sm" className="shrink-0 self-start" loading={pending === r.id} onClick={() => void markDone(r.id)}>{t.markDone}</Button> : null}
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-sunken p-4 text-sm leading-relaxed text-ink">{r.message}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
