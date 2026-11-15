'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Nfc } from 'lucide-react';
import type { DeviceSecurity, Page } from '@tapperl/types';
import { Badge, Card, defineCopy, EmptyState, formatRelative, PageHeader, Pagination, Segmented, Skeleton, Table, Td, Th, useCopy } from '@tapperl/ui';
import { deviceKind, deviceSecurity, deviceStatus } from '@/lib/labels';
import { LoadError, pagedKey, SearchField } from '@/components/admin/shared';
import type { AdminDeviceRow } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    title: 'Hardware',
    description: 'Alle registrierten NFC-Stempel auf der Plattform.',
    search: 'Nach Gerät, Kennung oder Betrieb suchen',
    filter: 'Sicherheitsstatus',
    all: 'Alle',
    colDevice: 'Gerät',
    colOrg: 'Betrieb',
    colStatus: 'Status',
    colSecurity: 'Sicherheit',
    colRejected: 'Abgelehnte Taps',
    colKey: 'Schlüsselversion',
    colLastUsed: 'Zuletzt genutzt',
    emptyTitle: 'Keine Geräte gefunden',
    emptyText: 'Für diesen Filter gibt es keine Geräte.',
  },
});

type Filter = 'ALL' | DeviceSecurity;

export default function AdminHardwarePage() {
  const t = useCopy(copy);
  const [q, setQ] = React.useState('');
  const [security, setSecurity] = React.useState<Filter>('ALL');
  const [page, setPage] = React.useState(1);
  const list = useSWR<Page<AdminDeviceRow>>(pagedKey('/admin/devices', { q, security: security === 'ALL' ? undefined : security, page, pageSize: 25 }), { keepPreviousData: true });
  const search = React.useCallback((value: string) => (setQ(value), setPage(1)), []);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <SearchField onSearch={search} label={t.search} />
          <div className="overflow-x-auto">
            <Segmented
              label={t.filter}
              size="sm"
              value={security}
              onChange={(value) => (setSecurity(value), setPage(1))}
              options={[{ value: 'ALL', label: t.all }, ...(['OK', 'WARNING', 'COMPROMISED'] as const).map((key) => ({ value: key, label: deviceSecurity[key].label }))]}
            />
          </div>
        </div>
        {list.error ? (
          <LoadError error={list.error} onRetry={() => void list.mutate()} />
        ) : !list.data ? (
          <div className="flex flex-col gap-3 border-t border-line p-5 sm:p-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
        ) : list.data.items.length === 0 ? (
          <EmptyState icon={<Nfc />} title={t.emptyTitle} description={t.emptyText} className="border-t border-line" />
        ) : (
          <div className="border-t border-line">
            <Table>
              <thead>
                <tr>
                  <Th>{t.colDevice}</Th>
                  <Th>{t.colOrg}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th>{t.colSecurity}</Th>
                  <Th className="text-right">{t.colRejected}</Th>
                  <Th className="hidden text-right lg:table-cell">{t.colKey}</Th>
                  <Th className="hidden lg:table-cell">{t.colLastUsed}</Th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((dev) => (
                  <tr key={dev.id}>
                    <Td className="min-w-52">
                      <p className="font-medium">{dev.name}</p>
                      <p className="text-xs text-muted">{deviceKind[dev.kind] ?? dev.kind} · <code className="font-mono">{dev.publicId}</code></p>
                    </Td>
                    <Td className="min-w-40"><Link href={`/admin/betriebe/${dev.organization.id}`} className="hover:underline">{dev.organization.name}</Link></Td>
                    <Td><Badge tone={deviceStatus[dev.status]?.tone}>{deviceStatus[dev.status]?.label ?? dev.status}</Badge></Td>
                    <Td><Badge tone={deviceSecurity[dev.securityStatus]?.tone}>{deviceSecurity[dev.securityStatus]?.label ?? dev.securityStatus}</Badge></Td>
                    <Td className="text-right tabular">{dev.rejectedTaps}</Td>
                    <Td className="hidden text-right tabular lg:table-cell">{dev.keyVersion}</Td>
                    <Td className="hidden whitespace-nowrap text-muted lg:table-cell">{formatRelative(dev.lastUsedAt)}</Td>
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
