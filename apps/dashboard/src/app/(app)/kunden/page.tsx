'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ChevronRight, Download, Plus, Search, Users, X } from 'lucide-react';
import type { CustomerListItemDto, Page, ProgramDto } from '@tapperl/types';
import { Badge, Button, buttonClass, Card, cn, defineCopy, EmptyState, ErrorState, formatDate, formatRelative, fullName, Input, PageHeader, Pagination, Select, Skeleton, Table, Td, Th, useCopy, useToast } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { useDebounced } from '@/components/counter/hooks';
import { StampBar } from '@/components/counter/progress';
import { CustomerFormDialog } from '@/components/customers/customer-form';
import { customerStatus } from '@/components/customers/labels';

const copy = defineCopy({
  de: {
    title: 'Kunden',
    description: 'Alle Menschen mit einer Treuekarte bei dir.',
    create: 'Kunde anlegen',
    export: 'Als CSV exportieren',
    searchLabel: 'Kunden suchen',
    searchPlaceholder: 'Name, E-Mail, Telefon oder Kartencode',
    clearSearch: 'Suche leeren',
    status: 'Status',
    statusAll: 'Alle',
    statusActive: 'Nur aktive',
    statusBlocked: 'Nur gesperrte',
    statusDeleted: 'Gelöschte',
    activity: 'Aktivität',
    activityAll: 'Alle',
    active30: 'In den letzten 30 Tagen aktiv',
    inactive60: 'Seit über 60 Tagen nicht da',
    rewardReady: 'Prämie bereit',
    new30: 'Neu in den letzten 30 Tagen',
    program: 'Treuekarte',
    programAll: 'Alle Karten',
    sort: 'Sortierung',
    sortRecent: 'Zuletzt aktiv',
    sortName: 'Name (A–Z)',
    sortCreated: 'Neueste zuerst',
    reset: 'Filter zurücksetzen',
    total: (n: number) => (n === 1 ? '1 Kunde' : `${n.toLocaleString('de-DE')} Kunden`),
    colName: 'Name',
    colCard: 'Karte',
    colVisits: 'Besuche',
    colLast: 'Zuletzt aktiv',
    colSince: 'Dabei seit',
    colStatus: 'Status',
    noCard: 'Keine Karte',
    noContact: 'Keine Kontaktdaten',
    balance: (b: number, r: number) => `${b} von ${r}`,
    visits: (n: number) => (n === 1 ? '1 Besuch' : `${n} Besuche`),
    emptyTitle: 'Noch keine Kunden',
    emptyText: 'Kunden melden sich selbst an, wenn sie zum ersten Mal ihr Handy an den Stempel halten. Du kannst sie auch von Hand anlegen.',
    emptyFilteredTitle: 'Keine Treffer',
    emptyFilteredText: 'Zu deiner Suche oder deinen Filtern passt gerade niemand.',
    errorText: 'Die Kundenliste konnte nicht geladen werden.',
    created: (name: string) => `${name} wurde angelegt.`,
    forbiddenTitle: 'Kein Zugriff',
    forbiddenText: 'Dir fehlt die Berechtigung, Kunden anzusehen.',
    open: 'Profil öffnen',
  },
});

type StatusFilter = '' | 'ACTIVE' | 'BLOCKED' | 'ANONYMIZED';
type ActivityFilter = '' | 'active30' | 'inactive60' | 'reward_ready' | 'new30';
type Sort = 'recent' | 'name' | 'created';
const PAGE_SIZE = 25;

function CardSummary({ customer }: { customer: CustomerListItemDto }) {
  const t = useCopy(copy);
  if (customer.cards.length === 0) return <span className="text-muted">{t.noCard}</span>;
  return (
    <div className="flex flex-col gap-2">
      {customer.cards.map((card) => (
        <div key={card.id} className="min-w-36 max-w-56">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-muted">{card.program.name}</span>
            <span className="shrink-0 font-medium text-ink tabular">{t.balance(card.balance, card.program.stampsRequired)}</span>
          </div>
          <StampBar balance={card.balance} required={card.program.stampsRequired} className="mt-1" />
        </div>
      ))}
    </div>
  );
}

export default function CustomersPage() {
  const t = useCopy(copy);
  const { can } = useSession();
  const router = useRouter();
  const toast = useToast();
  const allowed = can('customers.read');

  const [search, setSearch] = React.useState('');
  const q = useDebounced(search.trim(), 300);
  const [status, setStatus] = React.useState<StatusFilter>('');
  const [activity, setActivity] = React.useState<ActivityFilter>('');
  const [programId, setProgramId] = React.useState('');
  const [sort, setSort] = React.useState<Sort>('recent');
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  // Bei geänderter Suche wieder auf Seite 1 beginnen.
  React.useEffect(() => setPage(1), [q]);

  const query = new URLSearchParams({ sort, page: String(page), pageSize: String(PAGE_SIZE) });
  if (q) query.set('q', q);
  if (status) query.set('status', status);
  if (activity) query.set('activity', activity);
  if (programId) query.set('programId', programId);

  const { data, error, mutate, isValidating } = useSWR<Page<CustomerListItemDto>>(allowed ? `/customers?${query.toString()}` : null, { keepPreviousData: true });
  const programs = useSWR<ProgramDto[]>(allowed ? '/programs' : null);
  const filtered = Boolean(q || status || activity || programId);
  const searching = search.trim() !== q || (isValidating && Boolean(data));

  const reset = () => {
    setSearch('');
    setStatus('');
    setActivity('');
    setProgramId('');
    setPage(1);
  };
  const change = <T,>(setter: (v: T) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value as T);
    setPage(1);
  };

  if (!allowed) {
    return (
      <>
        <PageHeader title={t.title} />
        <ErrorState title={t.forbiddenTitle} description={t.forbiddenText} />
      </>
    );
  }

  const createButton = can('customers.manage') ? (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" aria-hidden />
      {t.create}
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            {can('customers.export') ? (
              <a href="/api/customers/export.csv" download="kunden.csv" className={buttonClass({ variant: 'outline' })}>
                <Download className="size-4" aria-hidden />
                {t.export}
              </a>
            ) : null}
            {createButton}
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-5 sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input type="search" aria-label={t.searchLabel} placeholder={t.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 px-9 [&::-webkit-search-cancel-button]:hidden" autoComplete="off" maxLength={100} />
            {search ? (
              <button type="button" onClick={() => setSearch('')} aria-label={t.clearSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted hover:bg-sunken hover:text-ink">
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Select aria-label={t.status} value={status} onChange={change<StatusFilter>(setStatus)}>
              <option value="">{t.status}: {t.statusAll}</option>
              <option value="ACTIVE">{t.statusActive}</option>
              <option value="BLOCKED">{t.statusBlocked}</option>
              <option value="ANONYMIZED">{t.statusDeleted}</option>
            </Select>
            <Select aria-label={t.activity} value={activity} onChange={change<ActivityFilter>(setActivity)}>
              <option value="">{t.activity}: {t.activityAll}</option>
              <option value="active30">{t.active30}</option>
              <option value="inactive60">{t.inactive60}</option>
              <option value="reward_ready">{t.rewardReady}</option>
              <option value="new30">{t.new30}</option>
            </Select>
            <Select aria-label={t.program} value={programId} onChange={change<string>(setProgramId)} disabled={!programs.data}>
              <option value="">{t.programAll}</option>
              {(programs.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select aria-label={t.sort} value={sort} onChange={change<Sort>(setSort)}>
              <option value="recent">{t.sortRecent}</option>
              <option value="name">{t.sortName}</option>
              <option value="created">{t.sortCreated}</option>
            </Select>
          </div>
          <div className="flex min-h-6 items-center justify-between gap-3">
            <p className="text-sm text-muted tabular" aria-live="polite">
              {data ? t.total(data.total) : ''}
            </p>
            {filtered ? (
              <button type="button" onClick={reset} className="text-sm font-medium text-brand hover:underline">
                {t.reset}
              </button>
            ) : null}
          </div>
        </div>

        {error && !data ? (
          <ErrorState description={t.errorText} onRetry={() => void mutate()} />
        ) : !data ? (
          <div className="flex flex-col gap-3 p-5 sm:p-6" aria-busy="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          filtered ? (
            <EmptyState icon={<Search />} title={t.emptyFilteredTitle} description={t.emptyFilteredText} action={<Button variant="outline" onClick={reset}>{t.reset}</Button>} />
          ) : (
            <EmptyState icon={<Users />} title={t.emptyTitle} description={t.emptyText} action={createButton ?? undefined} />
          )
        ) : (
          <div className={cn('@container transition-opacity', searching && 'opacity-60')}>
            <div className="hidden @3xl:block">
              <Table>
                <thead>
                  <tr>
                    <Th>{t.colName}</Th>
                    <Th>{t.colCard}</Th>
                    <Th className="text-right">{t.colVisits}</Th>
                    <Th>{t.colLast}</Th>
                    <Th className="hidden xl:table-cell">{t.colSince}</Th>
                    <Th>{t.colStatus}</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id} className="hover:bg-paper">
                      <Td>
                        <Link href={`/kunden/${c.id}`} className="font-medium text-ink hover:underline">
                          {fullName(c)}
                        </Link>
                        <span className="block max-w-60 truncate text-xs text-muted">{c.email ?? c.phone ?? (c.status === 'ANONYMIZED' ? '' : t.noContact)}</span>
                      </Td>
                      <Td><CardSummary customer={c} /></Td>
                      <Td className="text-right tabular">{c.cards.reduce((sum, card) => sum + card.visits, 0)}</Td>
                      <Td className="whitespace-nowrap text-muted">{formatRelative(c.lastActivityAt)}</Td>
                      <Td className="hidden whitespace-nowrap text-muted tabular xl:table-cell">{formatDate(c.createdAt)}</Td>
                      <Td><Badge tone={customerStatus[c.status].tone}>{customerStatus[c.status].label}</Badge></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <ul className="divide-y divide-line @3xl:hidden">
              {data.items.map((c) => (
                <li key={c.id}>
                  <Link href={`/kunden/${c.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-paper" aria-label={`${fullName(c)} – ${t.open}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-ink">{fullName(c)}</p>
                        {c.status !== 'ACTIVE' ? <Badge tone={customerStatus[c.status].tone}>{customerStatus[c.status].label}</Badge> : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[c.email ?? c.phone, `${t.colLast}: ${formatRelative(c.lastActivityAt)}`].filter(Boolean).join(' · ')}
                      </p>
                      {c.cards.length > 0 ? (
                        <div className="mt-2.5">
                          <CardSummary customer={c} />
                        </div>
                      ) : null}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </div>
        )}
      </Card>

      <CustomerFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(detail) => {
          setCreating(false);
          toast.success(t.created(fullName(detail.customer)));
          void mutate();
          router.push(`/kunden/${detail.customer.id}`);
        }}
      />
    </>
  );
}
