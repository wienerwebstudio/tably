'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Users } from 'lucide-react';
import type { Page } from '@tably/types';
import { api, Badge, Button, Card, ConfirmDialog, defineCopy, EmptyState, errorMessage, formatRelative, PageHeader, Pagination, Skeleton, Table, Td, Th, useCopy, useToast } from '@tably/ui';
import { useMe } from '@/lib/session';
import { roleLabel } from '@/lib/labels';
import { LoadError, pagedKey, SearchField } from '@/components/admin/shared';
import type { AdminUserRow } from '@/components/admin/types';

const copy = defineCopy({
  de: {
    title: 'Benutzer',
    description: 'Alle Konten von Händlern und ihren Teams.',
    search: 'Nach Name oder E-Mail suchen',
    colUser: 'Benutzer',
    colOrgs: 'Betriebe',
    colSecurity: 'Sicherheit',
    colLastLogin: 'Letzte Anmeldung',
    colActions: 'Aktionen',
    superAdmin: 'Plattformbetreiber',
    disabled: 'Gesperrt',
    unverified: 'E-Mail unbestätigt',
    mfa: '2FA aktiv',
    noMfa: 'ohne 2FA',
    noOrg: 'kein Betrieb',
    never: 'noch nie',
    you: 'Du',
    disable: 'Sperren',
    enable: 'Entsperren',
    disableTitle: (name: string) => `${name} sperren?`,
    disableText: 'Die Person wird sofort überall abgemeldet und kann sich nicht mehr anmelden.',
    enableTitle: (name: string) => `${name} entsperren?`,
    enableText: 'Die Person kann sich danach wieder anmelden.',
    disabledToast: 'Benutzer gesperrt.',
    enabledToast: 'Benutzer entsperrt.',
    emptyTitle: 'Keine Benutzer gefunden',
    emptyText: 'Für diese Suche gibt es keine Treffer.',
  },
});

export default function AdminUsersPage() {
  const t = useCopy(copy);
  const toast = useToast();
  const { me } = useMe();
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const list = useSWR<Page<AdminUserRow>>(pagedKey('/admin/users', { q, page, pageSize: 25 }), { keepPreviousData: true });
  const search = React.useCallback((value: string) => (setQ(value), setPage(1)), []);
  const [target, setTarget] = React.useState<AdminUserRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  const toggle = async () => {
    if (!target) return;
    const disable = !target.disabledAt;
    setBusy(true);
    try {
      await api(`/admin/users/${target.id}`, { method: 'PATCH', body: { disabled: disable } });
      await list.mutate();
      toast.success(disable ? t.disabledToast : t.enabledToast);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      setTarget(null);
    }
  };

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
          <EmptyState icon={<Users />} title={t.emptyTitle} description={t.emptyText} className="border-t border-line" />
        ) : (
          <div className="border-t border-line">
            <Table>
              <thead>
                <tr>
                  <Th>{t.colUser}</Th>
                  <Th>{t.colOrgs}</Th>
                  <Th className="hidden md:table-cell">{t.colSecurity}</Th>
                  <Th className="hidden lg:table-cell">{t.colLastLogin}</Th>
                  <Th aria-label={t.colActions} />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((u) => (
                  <tr key={u.id}>
                    <Td className="min-w-52">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {u.name}
                        {u.id === me?.user.id ? <Badge tone="brand">{t.you}</Badge> : null}
                        {u.isSuperAdmin ? <Badge tone="honey">{t.superAdmin}</Badge> : null}
                        {u.disabledAt ? <Badge tone="danger">{t.disabled}</Badge> : null}
                      </p>
                      <p className="break-all text-muted">{u.email}</p>
                    </Td>
                    <Td className="min-w-44">
                      {u.memberships.length === 0 ? (
                        <span className="text-muted">{t.noOrg}</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {u.memberships.map((m) => (
                            <li key={m.organization.id}>
                              <Link href={`/admin/betriebe/${m.organization.id}`} className="hover:underline">{m.organization.name}</Link>
                              <span className="text-muted"> · {roleLabel[m.role] ?? m.role}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Td>
                    <Td className="hidden md:table-cell">
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={u.totpEnabledAt ? 'success' : 'neutral'}>{u.totpEnabledAt ? t.mfa : t.noMfa}</Badge>
                        {!u.emailVerifiedAt ? <Badge tone="warn">{t.unverified}</Badge> : null}
                      </span>
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted lg:table-cell">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : t.never}</Td>
                    <Td className="w-px text-right">
                      {u.id !== me?.user.id ? (
                        <Button variant="outline" size="sm" onClick={() => setTarget(u)}>
                          {u.disabledAt ? t.enable : t.disable}
                        </Button>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => !open && setTarget(null)}
        title={target ? (target.disabledAt ? t.enableTitle(target.name) : t.disableTitle(target.name)) : ''}
        description={target?.disabledAt ? t.enableText : t.disableText}
        confirmLabel={target?.disabledAt ? t.enable : t.disable}
        danger={!target?.disabledAt}
        loading={busy}
        onConfirm={toggle}
      />
    </>
  );
}
