'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { MoreHorizontal, ShieldCheck, ShieldOff, UserMinus, UserPlus, Users } from 'lucide-react';
import { assignableRoles, type MemberDto, type MembersDto, type Role } from '@tapperl/types';
import { Alert, api, Badge, Button, Card, CardHeader, cn, ConfirmDialog, defineCopy, Dialog, EmptyState, ErrorState, errorMessage, Field, formatDate, formatRelative, Input, Menu, MenuItem, Skeleton, Table, Td, Th, useCopy, useToast } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { roleHint, roleLabel } from '@/lib/labels';
import { formatLimit } from './shared';

const copy = defineCopy({
  de: {
    title: 'Team',
    description: 'Wer in deinem Betrieb mit Tapperl arbeitet und was die Person darf.',
    invite: 'Mitglied einladen',
    colName: 'Name',
    colRole: 'Rolle',
    colLastLogin: 'Letzte Anmeldung',
    col2fa: 'Zwei-Faktor',
    colActions: 'Aktionen',
    you: 'Du',
    never: 'noch nie',
    mfaOn: 'Aktiv',
    mfaOff: 'Nicht aktiv',
    actionsFor: (name: string) => `Aktionen für ${name}`,
    changeRole: 'Rolle ändern',
    remove: 'Aus dem Team entfernen',
    removeTitle: (name: string) => `${name} entfernen?`,
    removeText: 'Die Person verliert sofort den Zugriff auf diesen Betrieb. Ihre bisherigen Buchungen bleiben im Verlauf erhalten.',
    removeConfirm: 'Entfernen',
    removed: 'Teammitglied entfernt.',
    roleTitle: (name: string) => `Rolle von ${name} ändern`,
    roleSaved: 'Rolle geändert.',
    save: 'Speichern',
    cancel: 'Abbrechen',
    inviteTitle: 'Teammitglied einladen',
    inviteText: 'Die Person erhält eine E-Mail mit einem Link, der 7 Tage gültig ist.',
    email: 'E-Mail-Adresse',
    role: 'Rolle',
    send: 'Einladung senden',
    invited: (email: string) => `Einladung an ${email} gesendet.`,
    limitTitle: 'Limit deines Tarifs erreicht',
    limitLink: 'Tarif ansehen',
    pendingTitle: 'Offene Einladungen',
    pendingEmpty: 'Keine offenen Einladungen.',
    expires: (date: string) => `gültig bis ${date}`,
    revoke: 'Zurückziehen',
    revokeTitle: 'Einladung zurückziehen?',
    revokeText: (email: string) => `Der Link in der E-Mail an ${email} funktioniert danach nicht mehr.`,
    revoked: 'Einladung zurückgezogen.',
    emptyTitle: 'Noch kein Team',
    usage: (used: number, limit: string) => `${used} von ${limit} Plätzen belegt (inklusive offener Einladungen)`,
  },
});

function RolePicker({ roles, value, onChange, legend }: { roles: Role[]; value: Role; onChange: (r: Role) => void; legend: string }) {
  const name = React.useId();
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <div className="mt-2 flex flex-col gap-2">
        {roles.map((role) => (
          <label key={role} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3', value === role ? 'border-brand bg-brand-soft' : 'border-line hover:bg-sunken')}>
            <input type="radio" name={name} value={role} checked={value === role} onChange={() => onChange(role)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{roleLabel[role]}</span>
              <span className="block text-sm text-muted">{roleHint[role]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function InviteDialog({ open, onOpenChange, roles, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; roles: Role[]; onDone: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<Role>(roles[roles.length - 1] ?? 'STAFF');
  const invite = useSubmit(async () => {
    await api('/organization/invitations', { body: { email, role } });
    await onDone();
    toast.success(t.invited(email.trim()));
    setEmail('');
    onOpenChange(false);
  });
  React.useEffect(() => {
    if (open) invite.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const formId = React.useId();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.inviteTitle}
      description={t.inviteText}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button type="submit" form={formId} loading={invite.loading}>{t.send}</Button>
        </>
      }
    >
      <form method="post" id={formId} className="flex flex-col gap-5" onSubmit={(e) => (e.preventDefault(), void invite.submit())} noValidate>
        {invite.error ? (
          invite.code === 'limit_reached' ? (
            <Alert tone="warn" title={t.limitTitle} action={<Link href="/einstellungen?tab=abo" className="whitespace-nowrap text-sm font-semibold underline">{t.limitLink}</Link>}>{invite.error}</Alert>
          ) : (
            <Alert tone="danger">{invite.error}</Alert>
          )
        ) : null}
        <Field label={t.email} error={invite.fields.email}>
          <Input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="off" maxLength={254} />
        </Field>
        <RolePicker roles={roles} value={role} onChange={setRole} legend={t.role} />
      </form>
    </Dialog>
  );
}

function RoleDialog({ member, roles, onOpenChange, onDone }: { member: MemberDto; roles: Role[]; onOpenChange: (o: boolean) => void; onDone: () => Promise<unknown> }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [role, setRole] = React.useState<Role>(member.role);
  const save = useSubmit(async () => {
    await api(`/organization/members/${member.id}`, { method: 'PATCH', body: { role } });
    await onDone();
    toast.success(t.roleSaved);
    onOpenChange(false);
  });
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t.roleTitle(member.name)}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          <Button loading={save.loading} disabled={role === member.role} onClick={() => void save.submit()}>{t.save}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {save.error ? <Alert tone="danger">{save.error}</Alert> : null}
        <RolePicker roles={roles} value={role} onChange={setRole} legend={t.role} />
      </div>
    </Dialog>
  );
}

export function TeamSettings() {
  const t = useCopy(copy);
  const { me } = useSession();
  const toast = useToast();
  const team = useSWR<MembersDto>('/organization/members');
  const roles = me.role ? assignableRoles(me.role) : [];
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [roleFor, setRoleFor] = React.useState<MemberDto | null>(null);
  const [removeFor, setRemoveFor] = React.useState<MemberDto | null>(null);
  const [revokeFor, setRevokeFor] = React.useState<MembersDto['invitations'][number] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const run = async (fn: () => Promise<unknown>, success: string, close: () => void) => {
    setBusy(true);
    try {
      await fn();
      await team.mutate();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      close();
    }
  };

  const limit = me.subscription?.limits.staff;
  const used = team.data ? team.data.members.length + team.data.invitations.length : 0;
  const editable = (m: MemberDto) => m.userId !== me.user.id && roles.includes(m.role);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title={t.title}
          description={
            <>
              {t.description}
              {team.data && limit !== undefined ? <span className="mt-1 block tabular">{t.usage(used, formatLimit(limit))}</span> : null}
            </>
          }
          action={roles.length > 0 ? <Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus className="size-4" aria-hidden />{t.invite}</Button> : undefined}
        />
        {team.error ? (
          <ErrorState onRetry={() => void team.mutate()} />
        ) : !team.data ? (
          <div className="flex flex-col gap-3 p-5 sm:p-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : team.data.members.length === 0 ? (
          <EmptyState icon={<Users />} title={t.emptyTitle} />
        ) : (
          <div className="mt-4 border-t border-line">
            <Table>
              <thead>
                <tr>
                  <Th>{t.colName}</Th>
                  <Th>{t.colRole}</Th>
                  <Th className="hidden md:table-cell">{t.colLastLogin}</Th>
                  <Th className="hidden sm:table-cell">{t.col2fa}</Th>
                  <Th aria-label={t.colActions} />
                </tr>
              </thead>
              <tbody>
                {team.data.members.map((m) => (
                  <tr key={m.id}>
                    <Td>
                      <p className="flex items-center gap-2 font-medium">
                        <span className="break-words">{m.name}</span>
                        {m.userId === me.user.id ? <Badge tone="brand">{t.you}</Badge> : null}
                      </p>
                      <p className="break-all text-muted">{m.email}</p>
                    </Td>
                    <Td><span className="whitespace-nowrap">{roleLabel[m.role]}</span></Td>
                    <Td className="hidden whitespace-nowrap text-muted md:table-cell">{m.lastLoginAt ? formatRelative(m.lastLoginAt) : t.never}</Td>
                    <Td className="hidden sm:table-cell">
                      {m.totpEnabled ? (
                        <Badge tone="success"><ShieldCheck className="size-3" aria-hidden />{t.mfaOn}</Badge>
                      ) : (
                        <Badge><ShieldOff className="size-3" aria-hidden />{t.mfaOff}</Badge>
                      )}
                    </Td>
                    <Td className="w-px text-right">
                      {editable(m) ? (
                        <Menu trigger={<button type="button" className="rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink" aria-label={t.actionsFor(m.name)}><MoreHorizontal className="size-4" /></button>}>
                          <MenuItem onSelect={() => setRoleFor(m)}><Users />{t.changeRole}</MenuItem>
                          <MenuItem danger onSelect={() => setRemoveFor(m)}><UserMinus />{t.remove}</MenuItem>
                        </Menu>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {team.data ? (
        <Card>
          <CardHeader title={t.pendingTitle} />
          {team.data.invitations.length === 0 ? (
            <p className="px-5 pb-5 pt-2 text-sm text-muted sm:px-6">{t.pendingEmpty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {team.data.invitations.map((inv) => (
                <li key={inv.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0 text-sm">
                    <p className="break-all font-medium text-ink">{inv.email}</p>
                    <p className="text-muted">{roleLabel[inv.role]} · {t.expires(formatDate(inv.expiresAt))}</p>
                  </div>
                  <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={() => setRevokeFor(inv)}>{t.revoke}</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={roles} onDone={() => team.mutate()} />
      {roleFor ? <RoleDialog member={roleFor} roles={roles} onOpenChange={(open) => !open && setRoleFor(null)} onDone={() => team.mutate()} /> : null}
      <ConfirmDialog
        open={Boolean(removeFor)}
        onOpenChange={(open) => !open && setRemoveFor(null)}
        title={removeFor ? t.removeTitle(removeFor.name) : ''}
        description={t.removeText}
        confirmLabel={t.removeConfirm}
        danger
        loading={busy}
        onConfirm={() => (removeFor ? run(() => api(`/organization/members/${removeFor.id}`, { method: 'DELETE' }), t.removed, () => setRemoveFor(null)) : undefined)}
      />
      <ConfirmDialog
        open={Boolean(revokeFor)}
        onOpenChange={(open) => !open && setRevokeFor(null)}
        title={t.revokeTitle}
        description={revokeFor ? t.revokeText(revokeFor.email) : ''}
        confirmLabel={t.revoke}
        danger
        loading={busy}
        onConfirm={() => (revokeFor ? run(() => api(`/organization/invitations/${revokeFor.id}`, { method: 'DELETE' }), t.revoked, () => setRevokeFor(null)) : undefined)}
      />
    </div>
  );
}
