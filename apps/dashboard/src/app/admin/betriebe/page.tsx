'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Building2 } from 'lucide-react';
import type { Page } from '@tably/types';
import { Badge, Card, defineCopy, EmptyState, formatDate, formatNumber, PageHeader, Pagination, Skeleton, Table, Td, Th, useCopy } from '@tably/ui';
import { industryLabel, subscriptionStatus } from '@/lib/labels';
import { LoadError, orgStatus, pagedKey, SearchField } from '@/components/admin/shared';
import type { AdminOrgRow } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    title: 'Betriebe',
    description: 'Alle Händler auf der Plattform.',
    search: 'Nach Name, Kürzel oder E-Mail suchen',
    colName: 'Betrieb',
    colStatus: 'Status',
    colPlan: 'Tarif',
    colCustomers: 'Kunden',
    colDevices: 'Stempel',
    colMembers: 'Team',
    colCreated: 'Angelegt',
    emptyTitle: 'Keine Betriebe gefunden',
    emptySearch: 'Für diese Suche gibt es keine Treffer.',
    emptyAll: 'Sobald sich der erste Händler registriert, erscheint er hier.',
    noSubscription: 'kein Abo',
  },
});

export default function AdminOrganizationsPage() {
  const t = useCopy(copy);
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const list = useSWR<Page<AdminOrgRow>>(pagedKey('/admin/organizations', { q, page, pageSize: 25 }), { keepPreviousData: true });
  const search = React.useCallback((value: string) => (setQ(value), setPage(1)), []);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Card>
        <div className="p-4 sm:px-6"><SearchField onSearch={search} label={t.search} /></div>
        {list.error ? (
          <LoadError error={list.error} onRetry={() => void list.mutate()} />
        ) : !list.data ? (
          <div className="flex flex-col gap-3 border-t border-line p-5 sm:p-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<Building2 />} title={t.emptyTitle} description={q ? t.emptySearch : t.emptyAll} className="border-t border-line" />
        ) : (
          <div className="border-t border-line">
            <Table>
              <thead>
                <tr>
                  <Th>{t.colName}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th>{t.colPlan}</Th>
                  <Th className="text-right">{t.colCustomers}</Th>
                  <Th className="hidden text-right md:table-cell">{t.colDevices}</Th>
                  <Th className="hidden text-right md:table-cell">{t.colMembers}</Th>
                  <Th className="hidden lg:table-cell">{t.colCreated}</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((org) => (
                  <tr key={org.id} className="hover:bg-sunken/50">
                    <Td className="min-w-48">
                      <Link href={`/admin/betriebe/${org.id}`} className="font-medium text-ink hover:underline">{org.name}</Link>
                      <p className="text-xs text-muted">{industryLabel[org.industry] ?? org.industry}{org.city ? ` · ${org.city}` : ''}</p>
                    </Td>
                    <Td><Badge tone={orgStatus[org.status]?.tone}>{orgStatus[org.status]?.label ?? org.status}</Badge></Td>
                    <Td>
                      {org.subscription ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="capitalize">{org.subscription.planId}</span>
                          <Badge tone={subscriptionStatus[org.subscription.status]?.tone}>{subscriptionStatus[org.subscription.status]?.label ?? org.subscription.status}</Badge>
                        </span>
                      ) : (
                        <span className="text-muted">{t.noSubscription}</span>
                      )}
                    </Td>
                    <Td className="text-right tabular">{formatNumber(org._count.customers)}</Td>
                    <Td className="hidden text-right tabular md:table-cell">{formatNumber(org._count.devices)}</Td>
                    <Td className="hidden text-right tabular md:table-cell">{formatNumber(org._count.members)}</Td>
                    <Td className="hidden whitespace-nowrap text-muted lg:table-cell">{formatDate(org.createdAt)}</Td>
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
