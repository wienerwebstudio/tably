'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { History } from 'lucide-react';
import type { Page, TransactionListItemDto, TransactionType } from '@tably/types';
import { Button, buttonClass, Card, Checkbox, cn, defineCopy, EmptyState, ErrorState, Field, PageHeader, Pagination, Select, Skeleton, useCopy } from '@tably/ui';
import { useSession } from '@/lib/session';
import { txType } from '@/lib/labels';
import { ReverseDialog } from '@/components/customers/booking-dialogs';
import { TransactionList, type TransactionRow } from '@/components/customers/transactions';

const copy = defineCopy({
  de: {
    title: 'Buchungen',
    description: 'Alle Stempel, Einlösungen, Korrekturen und Stornos deines Betriebs – die neuesten zuerst.',
    type: 'Art',
    allTypes: 'Alle Arten',
    flaggedOnly: 'Nur auffällige Buchungen',
    flaggedHint: 'Auffällig sind Buchungen, bei denen Mindestabstand oder Tageslimit übersteuert wurden oder ungewöhnlich viele Stempel in kurzer Zeit vergeben wurden.',
    reset: 'Filter zurücksetzen',
    total: (n: number) => (n === 1 ? '1 Buchung' : `${n.toLocaleString('de-DE')} Buchungen`),
    emptyTitle: 'Noch keine Buchungen',
    emptyText: 'Sobald der erste Stempel vergeben wird, erscheint er hier.',
    emptyAction: 'Zur Theke',
    emptyFilteredTitle: 'Keine passenden Buchungen',
    emptyFilteredText: 'Mit diesen Filtern gibt es keine Treffer.',
    emptyFlaggedTitle: 'Keine auffälligen Buchungen',
    emptyFlaggedText: 'Alles sieht gut aus – es wurde nichts zur Kontrolle markiert.',
    errorText: 'Die Buchungen konnten nicht geladen werden.',
    forbiddenTitle: 'Kein Zugriff',
    forbiddenText: 'Dir fehlt die Berechtigung, Buchungen anzusehen.',
  },
});

const TYPES: TransactionType[] = ['EARN', 'REDEEM', 'ADJUST', 'REVERSAL'];
const PAGE_SIZE = 25;
interface Filters {
  flagged: boolean;
  type: TransactionType | null;
  page: number;
}

function BookingsView() {
  const t = useCopy(copy);
  const { can } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Filter liegen in der URL (teilbar, Zurück-Taste funktioniert); der lokale
  // Zustand sorgt dafür, dass Eingaben sofort reagieren.
  const fromParams = React.useCallback((): Filters => {
    const rawType = params.get('type');
    return { flagged: params.get('flagged') === 'true', type: TYPES.find((x) => x === rawType) ?? null, page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1) };
  }, [params]);
  const [filters, setFilters] = React.useState<Filters>(fromParams);
  React.useEffect(() => setFilters(fromParams()), [fromParams]);
  const { flagged, type, page } = filters;

  const update = (changes: Partial<Filters>) => {
    const next: Filters = { ...filters, page: 1, ...changes };
    setFilters(next);
    const qs = new URLSearchParams();
    if (next.flagged) qs.set('flagged', 'true');
    if (next.type) qs.set('type', next.type);
    if (next.page > 1) qs.set('page', String(next.page));
    const text = qs.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (flagged) query.set('flagged', 'true');
  if (type) query.set('type', type);
  const allowed = can('customers.read');
  const { data, error, mutate, isValidating } = useSWR<Page<TransactionListItemDto>>(allowed ? `/stamps?${query.toString()}` : null, { keepPreviousData: true });
  const [reversing, setReversing] = React.useState<TransactionRow | null>(null);
  const filtered = flagged || type !== null;

  if (!allowed) {
    return (
      <>
        <PageHeader title={t.title} />
        <ErrorState title={t.forbiddenTitle} description={t.forbiddenText} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Card>
        <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-end sm:px-6">
          <Field label={t.type} className="sm:w-56">
            <Select value={type ?? ''} onChange={(e) => update({ type: TYPES.find((x) => x === e.target.value) ?? null })}>
              <option value="">{t.allTypes}</option>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {txType[x].label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex min-h-10 items-center">
            <Checkbox label={t.flaggedOnly} checked={flagged} onChange={(e) => update({ flagged: e.target.checked })} />
          </div>
          <p className="text-sm text-muted tabular sm:ml-auto sm:pb-2.5" aria-live="polite">
            {data ? t.total(data.total) : ''}
          </p>
        </div>

        {flagged ? <p className="border-b border-line bg-warn-soft px-5 py-3 text-sm text-muted sm:px-6">{t.flaggedHint}</p> : null}

        {error && !data ? (
          <ErrorState description={t.errorText} onRetry={() => void mutate()} />
        ) : !data ? (
          <div className="flex flex-col gap-3 p-5 sm:p-6" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-11 rounded-lg" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          flagged && !type ? (
            <EmptyState icon={<History />} title={t.emptyFlaggedTitle} description={t.emptyFlaggedText} action={<Button variant="outline" onClick={() => update({ flagged: false })}>{t.reset}</Button>} />
          ) : filtered ? (
            <EmptyState icon={<History />} title={t.emptyFilteredTitle} description={t.emptyFilteredText} action={<Button variant="outline" onClick={() => update({ flagged: false, type: null })}>{t.reset}</Button>} />
          ) : (
            <EmptyState icon={<History />} title={t.emptyTitle} description={t.emptyText} action={can('stamps.grant') ? <Link href="/theke" className={buttonClass({})}>{t.emptyAction}</Link> : undefined} />
          )
        ) : (
          <div className={cn('transition-opacity', isValidating && data.page !== page && 'opacity-60')}>
            <TransactionList items={data.items} showCustomer linkCustomer onReverse={can('stamps.adjust') ? setReversing : undefined} />
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: p })} />
          </div>
        )}
      </Card>

      <ReverseDialog
        transaction={reversing}
        onClose={() => setReversing(null)}
        onDone={() => {
          setReversing(null);
          void mutate();
        }}
      />
    </>
  );
}

export default function BookingsPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <BookingsView />
    </React.Suspense>
  );
}
