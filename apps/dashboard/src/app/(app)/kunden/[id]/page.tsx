'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { ArrowLeft, Ban, Download, History, Pencil, ShieldCheck, SlidersHorizontal, Trash2, UserX } from 'lucide-react';
import type { ConsentState, CustomerDetailDto } from '@tably/types';
import { Alert, api, ApiError, Badge, Button, buttonClass, Card, CardBody, CardHeader, Checkbox, ConfirmDialog, CopyButton, defineCopy, DefinitionList, Dialog, EmptyState, ErrorState, errorMessage, formatDate, formatDateTime, formatRelative, fullName, PageHeader, Skeleton, Switch, useCopy, useToast } from '@tably/ui';
import { useSession } from '@/lib/session';
import { programStatus } from '@/lib/labels';
import { CardActions } from '@/components/counter/card-actions';
import { useCounterLocation } from '@/components/counter/hooks';
import { StampProgress } from '@/components/counter/progress';
import { AdjustDialog, ReverseDialog } from '@/components/customers/booking-dialogs';
import { CustomerFormDialog } from '@/components/customers/customer-form';
import { cardStatus, consentLabel, customerSource, customerStatus, walletLabel } from '@/components/customers/labels';
import { TransactionList, type TransactionRow } from '@/components/customers/transactions';

const copy = defineCopy({
  de: {
    back: 'Alle Kunden',
    edit: 'Bearbeiten',
    block: 'Sperren',
    unblock: 'Entsperren',
    deletedName: 'Gelöschter Kunde',
    deletedTitle: 'Dieser Kunde wurde gelöscht',
    deletedText: 'Alle persönlichen Daten sind entfernt. Die Buchungen bleiben ohne Personenbezug für deine Statistik erhalten.',
    blockedTitle: 'Dieser Kunde ist gesperrt',
    blockedText: 'Stempel und Prämien sind nicht möglich, bis du die Sperre aufhebst.',
    notFoundTitle: 'Kunde nicht gefunden',
    notFoundText: 'Diesen Kunden gibt es nicht (mehr) oder er gehört zu einem anderen Betrieb.',
    errorText: 'Das Kundenprofil konnte nicht geladen werden.',
    // Karten
    cards: 'Treuekarten',
    noCards: 'Dieser Kunde hat keine Treuekarte.',
    cardCode: 'Kartencode',
    copyCode: 'Code kopieren',
    of: 'von',
    stamps: 'Stempeln',
    visits: 'Besuche',
    earned: 'Gesammelt',
    redeemed: 'Eingelöst',
    lastStamp: 'Letzter Stempel',
    since: 'Karte seit',
    noWallet: 'Nicht im Handy-Wallet gespeichert',
    adjust: 'Stand korrigieren',
    cardInactive: 'Diese Karte ist nicht aktiv. Stempel und Prämien sind nicht möglich.',
    programNotLive: (status: string) => `Diese Treuekarte ist gerade nicht veröffentlicht (${status}). Stempel sind deshalb nicht möglich.`,
    // Historie
    history: 'Historie',
    historyText: 'Alle Buchungen dieses Kunden, die neuesten zuerst.',
    historyLimit: 'Angezeigt werden die letzten 50 Buchungen.',
    historyEmptyTitle: 'Noch keine Buchungen',
    historyEmptyText: 'Sobald dieser Kunde einen Stempel bekommt, erscheint er hier.',
    // Stammdaten
    details: 'Stammdaten',
    email: 'E-Mail',
    phone: 'Telefon',
    birthday: 'Geburtstag',
    memberSince: 'Dabei seit',
    lastActivity: 'Zuletzt aktiv',
    source: 'Herkunft',
    notifications: 'Gesendete Nachrichten',
    note: 'Interne Notiz',
    saved: 'Änderungen gespeichert.',
    // Einwilligungen
    consents: 'Einwilligungen',
    consentsText: 'Wofür dieser Kunde zugestimmt hat. Ändere das nur auf ausdrücklichen Wunsch des Kunden.',
    granted: (date: string) => `Zugestimmt am ${date}`,
    revoked: (date: string) => `Abgelehnt oder widerrufen am ${date}`,
    never: 'Keine Angabe',
    yes: 'Ja',
    no: 'Nein',
    needsEmail: 'Dafür fehlt eine E-Mail-Adresse.',
    consentOn: (label: string) => `Einwilligung „${label}“ eingetragen.`,
    consentOff: (label: string) => `Einwilligung „${label}“ widerrufen.`,
    // Prämien
    redemptions: 'Eingelöste Prämien',
    // Sperren
    blockTitle: (name: string) => `${name} sperren?`,
    blockConfirmText: 'Der Kunde kann keine Stempel mehr sammeln und keine Prämien einlösen. Du kannst die Sperre jederzeit aufheben.',
    unblockTitle: (name: string) => `${name} entsperren?`,
    unblockConfirmText: 'Der Kunde kann danach wieder Stempel sammeln und Prämien einlösen.',
    blockedToast: 'Kunde gesperrt.',
    unblockedToast: 'Kunde entsperrt.',
    // Datenschutz
    privacy: 'Datenschutz',
    privacyText: 'Wenn ein Kunde Auskunft über seine Daten möchte oder gelöscht werden will, erledigst du das hier.',
    exportData: 'Daten exportieren',
    exportHint: 'Lädt alle gespeicherten Daten dieses Kunden als Datei herunter.',
    exported: 'Der Datenexport wurde heruntergeladen.',
    deleteData: 'Kundendaten löschen',
    deleteTitle: (name: string) => `Daten von ${name} endgültig löschen?`,
    deleteWarnTitle: 'Das lässt sich nicht rückgängig machen',
    deleteItems: ['Name, E-Mail, Telefon, Geburtstag und Notiz werden entfernt.', 'Alle Treuekarten werden gesperrt und aus dem Handy-Wallet entfernt – gesammelte Stempel verfallen.', 'Die Buchungen bleiben ohne Personenbezug für deine Statistik erhalten.'],
    deleteCheck: 'Ich habe verstanden, dass die Daten unwiderruflich gelöscht werden.',
    deleteConfirm: 'Endgültig löschen',
    cancel: 'Abbrechen',
    deletedToast: 'Die Kundendaten wurden gelöscht.',
  },
});

type Detail = CustomerDetailDto;
type DetailCard = Detail['cards'][number];

function CustomerCard({ card, detail, locationId, onChanged, onAdjust }: { card: DetailCard; detail: Detail; locationId: string | null; onChanged: () => void; onAdjust: (card: DetailCard) => void }) {
  const t = useCopy(copy);
  const { can } = useSession();
  const deleted = detail.customer.status === 'ANONYMIZED';
  const blockedReason = detail.customer.status === 'BLOCKED' ? t.blockedText : card.status !== 'ACTIVE' ? t.cardInactive : card.program.status !== 'PUBLISHED' ? t.programNotLive(programStatus[card.program.status].label) : null;
  const status = cardStatus[card.status];

  return (
    <li className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink">{card.program.name}</h3>
            {status && card.status !== 'ACTIVE' ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="sr-only">{t.cardCode}: </span>
            <span className="font-mono text-ink">{card.shortCode}</span>
            {deleted ? null : <CopyButton value={card.shortCode} label={t.copyCode} />}
          </p>
        </div>
        <p className="text-sm text-muted">
          <span className="mr-1.5 text-3xl font-semibold tracking-tight text-ink tabular">{card.balance}</span>
          {t.of} {card.program.stampsRequired} {t.stamps}
        </p>
      </div>

      <StampProgress balance={card.balance} required={card.program.stampsRequired} className="mt-3" />

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        {[
          { label: t.visits, value: card.visits },
          { label: t.earned, value: card.lifetimeEarned },
          { label: t.redeemed, value: card.lifetimeRedeemed },
          { label: t.lastStamp, value: formatRelative(card.lastStampAt) },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-muted">{item.label}</dt>
            <dd className="font-medium text-ink tabular">{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{t.since} {formatDate(card.createdAt)}</span>
        <span aria-hidden>·</span>
        {card.wallets.length > 0 ? card.wallets.map((w) => <Badge key={w} tone="info">{walletLabel[w]}</Badge>) : <span>{t.noWallet}</span>}
      </div>

      {deleted ? null : (
        <>
          {blockedReason && detail.customer.status !== 'BLOCKED' ? <Alert tone="warn" className="mt-4">{blockedReason}</Alert> : null}
          {can('stamps.grant') ? (
            <div className="mt-5 border-t border-line pt-5">
              <CardActions size="md" card={{ cardId: card.id, balance: card.balance, customerName: fullName(detail.customer), rewards: card.rewards }} locationId={locationId} disabled={blockedReason !== null} onChanged={onChanged} onFailed={onChanged} />
            </div>
          ) : null}
          {can('stamps.adjust') ? (
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => onAdjust(card)} className="-ml-2">
                <SlidersHorizontal className="size-4" aria-hidden />
                {t.adjust}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </li>
  );
}

function Consents({ detail, onChange }: { detail: Detail; onChange: (consents: ConsentState) => void }) {
  const t = useCopy(copy);
  const { can } = useSession();
  const toast = useToast();
  const [saving, setSaving] = React.useState<string | null>(null);
  const editable = can('customers.manage');

  const stateText = (entry: ConsentState[keyof ConsentState]) => (entry ? (entry.granted ? t.granted(formatDate(entry.at)) : t.revoked(formatDate(entry.at))) : t.never);

  const toggle = async (type: 'MARKETING_EMAIL' | 'MARKETING_WALLET', granted: boolean) => {
    setSaving(type);
    try {
      const consents = await api<ConsentState>(`/customers/${detail.customer.id}/consents`, { method: 'PUT', body: { type, granted } });
      onChange(consents);
      toast.success(granted ? t.consentOn(consentLabel[type].label) : t.consentOff(consentLabel[type].label));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader title={t.consents} description={t.consentsText} />
      <CardBody className="flex flex-col gap-4">
        {(['MARKETING_EMAIL', 'MARKETING_WALLET'] as const).map((type) => {
          const entry = detail.consents[type];
          const granted = entry?.granted ?? false;
          const missingEmail = type === 'MARKETING_EMAIL' && !detail.customer.email && !granted;
          const description = (
            <>
              {consentLabel[type].hint}
              <span className="block text-xs">{missingEmail ? t.needsEmail : stateText(entry)}</span>
            </>
          );
          return editable ? (
            <Switch key={type} label={consentLabel[type].label} description={description} checked={granted} disabled={saving !== null || missingEmail} onCheckedChange={(v) => void toggle(type, v)} />
          ) : (
            <div key={type} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{consentLabel[type].label}</p>
                <p className="mt-0.5 text-sm text-muted">{description}</p>
              </div>
              <Badge tone={granted ? 'success' : 'neutral'}>{granted ? t.yes : t.no}</Badge>
            </div>
          );
        })}
        {(['PRIVACY', 'TERMS'] as const).map((type) => {
          const entry = detail.consents[type];
          if (!entry) return null;
          return (
            <div key={type} className="flex items-start justify-between gap-4 border-t border-line pt-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{consentLabel[type].label}</p>
                <p className="mt-0.5 text-xs text-muted">{stateText(entry)}</p>
              </div>
              <Badge tone={entry.granted ? 'success' : 'neutral'}>{entry.granted ? t.yes : t.no}</Badge>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="mb-8 h-8 w-64" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function CustomerProfilePage() {
  const t = useCopy(copy);
  const { id } = useParams<{ id: string }>();
  const { can } = useSession();
  const router = useRouter();
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const allowed = can('customers.read');
  const { data, error, mutate } = useSWR<Detail, ApiError>(allowed ? `/customers/${id}` : null);
  const location = useCounterLocation();

  const [editing, setEditing] = React.useState(false);
  const [statusDialog, setStatusDialog] = React.useState(false);
  const [statusSaving, setStatusSaving] = React.useState(false);
  const [adjusting, setAdjusting] = React.useState<DetailCard | null>(null);
  const [reversing, setReversing] = React.useState<TransactionRow | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteChecked, setDeleteChecked] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const back = (
    <Link href="/kunden" className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden />
      {t.back}
    </Link>
  );
  const refreshLists = () => void globalMutate((key) => typeof key === 'string' && (key.startsWith('/customers?') || key.startsWith('/stamps?') || key === '/analytics/today'));

  if (!allowed || (error && !data)) {
    const missing = !allowed || error?.status === 404 || error?.status === 403;
    return (
      <>
        <PageHeader title={missing ? t.notFoundTitle : t.back} back={back} />
        <Card>{missing ? <EmptyState icon={<UserX />} title={t.notFoundTitle} description={t.notFoundText} action={<Link href="/kunden" className={buttonClass({ variant: 'outline' })}>{t.back}</Link>} /> : <ErrorState description={t.errorText} onRetry={() => void mutate()} />}</Card>
      </>
    );
  }
  if (!data) return <ProfileSkeleton />;

  const { customer } = data;
  const deleted = customer.status === 'ANONYMIZED';
  const blocked = customer.status === 'BLOCKED';
  const name = deleted ? t.deletedName : fullName(customer);
  const programByCard = new Map(data.cards.map((c) => [c.id, c.program.name]));
  const transactions: TransactionRow[] = data.transactions.map((tx) => ({ ...tx, programName: data.cards.length > 1 ? programByCard.get(tx.cardId) : undefined }));

  const changed = () => {
    void mutate();
    refreshLists();
  };

  const saveStatus = async () => {
    setStatusSaving(true);
    try {
      const next = await api<Detail>(`/customers/${customer.id}`, { method: 'PATCH', body: { status: blocked ? 'ACTIVE' : 'BLOCKED' } });
      await mutate(next, { revalidate: false });
      refreshLists();
      toast.success(blocked ? t.unblockedToast : t.blockedToast);
      setStatusDialog(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setStatusSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const payload = await api<unknown>(`/customers/${customer.id}/export`);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = fullName(customer).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kunde';
      a.href = url;
      a.download = `kundendaten-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t.exported);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/customers/${customer.id}`, { method: 'DELETE' });
      toast.success(t.deletedToast);
      refreshLists();
      void globalMutate(`/customers/${customer.id}`, undefined, { revalidate: false });
      router.push('/kunden');
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
    }
  };

  const sourceLabel = customerSource[customer.source];

  return (
    <>
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{name}</span>
            <Badge tone={customerStatus[customer.status].tone}>{customerStatus[customer.status].label}</Badge>
          </span>
        }
        actions={
          !deleted && can('customers.manage') ? (
            <>
              <Button variant="outline" onClick={() => setStatusDialog(true)}>
                {blocked ? <ShieldCheck className="size-4" aria-hidden /> : <Ban className="size-4" aria-hidden />}
                {blocked ? t.unblock : t.block}
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden />
                {t.edit}
              </Button>
            </>
          ) : undefined
        }
      />

      {deleted ? <Alert tone="info" title={t.deletedTitle} className="mb-5">{t.deletedText}</Alert> : null}
      {blocked ? <Alert tone="danger" title={t.blockedTitle} className="mb-5">{t.blockedText}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader title={t.cards} />
            {data.cards.length === 0 ? (
              <EmptyState title={t.noCards} className="py-10" />
            ) : (
              <CardBody>
                <ul className="flex flex-col gap-4">
                  {data.cards.map((card) => (
                    <CustomerCard key={card.id} card={card} detail={data} locationId={location.locationId} onChanged={changed} onAdjust={setAdjusting} />
                  ))}
                </ul>
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title={t.history} description={data.transactions.length >= 50 ? `${t.historyText} ${t.historyLimit}` : t.historyText} />
            {transactions.length === 0 ? (
              <EmptyState icon={<History />} title={t.historyEmptyTitle} description={t.historyEmptyText} className="py-10" />
            ) : (
              <div className="mt-3 pb-2">
                <TransactionList items={transactions} showProgram onReverse={!deleted && can('stamps.adjust') ? setReversing : undefined} />
              </div>
            )}
          </Card>
        </div>

        {deleted ? null : (
          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <CardHeader
                title={t.details}
                action={
                  can('customers.manage') ? (
                    <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-brand hover:underline">
                      {t.edit}
                    </button>
                  ) : undefined
                }
              />
              <CardBody className="pt-3">
                <DefinitionList
                  items={[
                    { label: t.email, value: customer.email ? <a href={`mailto:${customer.email}`} className="break-all hover:underline">{customer.email}</a> : '–' },
                    { label: t.phone, value: customer.phone ? <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a> : '–' },
                    { label: t.birthday, value: formatDate(customer.birthday) },
                    { label: t.memberSince, value: formatDate(customer.createdAt) },
                    { label: t.lastActivity, value: customer.lastActivityAt ? <span title={formatDateTime(customer.lastActivityAt)}>{formatRelative(customer.lastActivityAt)}</span> : 'nie' },
                    ...(sourceLabel ? [{ label: t.source, value: sourceLabel }] : []),
                    { label: t.notifications, value: data.notificationCount.toLocaleString('de-DE') },
                  ]}
                />
                {customer.note ? (
                  <div className="mt-3 rounded-xl bg-sunken p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-subtle">{t.note}</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{customer.note}</p>
                  </div>
                ) : null}
              </CardBody>
            </Card>

            <Consents detail={data} onChange={(consents) => void mutate({ ...data, consents }, { revalidate: false })} />

            {data.redemptions.length > 0 ? (
              <Card>
                <CardHeader title={t.redemptions} />
                <CardBody className="pt-3">
                  <ul className="divide-y divide-line text-sm">
                    {data.redemptions.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0 truncate font-medium text-ink">{r.rewardName}</span>
                        <span className="shrink-0 text-muted tabular">{formatDate(r.completedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}

            {can('customers.export') ? (
              <Card>
                <CardHeader title={t.privacy} description={t.privacyText} />
                <CardBody className="flex flex-col gap-3">
                  <Button variant="outline" onClick={() => void exportData()} loading={exporting} className="w-full">
                    {exporting ? null : <Download className="size-4" aria-hidden />}
                    {t.exportData}
                  </Button>
                  <p className="-mt-1 text-xs text-muted">{t.exportHint}</p>
                  <Button
                    variant="outline"
                    className="w-full border-danger/40 text-danger hover:bg-danger-soft"
                    onClick={() => {
                      setDeleteChecked(false);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t.deleteData}
                  </Button>
                </CardBody>
              </Card>
            ) : null}
          </div>
        )}
      </div>

      <CustomerFormDialog
        open={editing}
        onOpenChange={setEditing}
        customer={customer}
        onSaved={(detail) => {
          setEditing(false);
          void mutate(detail, { revalidate: false });
          refreshLists();
          toast.success(t.saved);
        }}
      />
      <ConfirmDialog
        open={statusDialog}
        onOpenChange={(open) => (!statusSaving ? setStatusDialog(open) : undefined)}
        title={blocked ? t.unblockTitle(name) : t.blockTitle(name)}
        description={blocked ? t.unblockConfirmText : t.blockConfirmText}
        confirmLabel={blocked ? t.unblock : t.block}
        danger={!blocked}
        loading={statusSaving}
        onConfirm={saveStatus}
      />
      <AdjustDialog
        card={adjusting ? { id: adjusting.id, balance: adjusting.balance, programName: adjusting.program.name } : null}
        onClose={() => setAdjusting(null)}
        onDone={() => {
          setAdjusting(null);
          changed();
        }}
      />
      <ReverseDialog
        transaction={reversing}
        onClose={() => setReversing(null)}
        onDone={() => {
          setReversing(null);
          changed();
        }}
      />
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => (!deleting ? setDeleteOpen(open) : undefined)}
        title={t.deleteTitle(name)}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={() => void remove()} loading={deleting} disabled={!deleteChecked}>
              {t.deleteConfirm}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert tone="danger" title={t.deleteWarnTitle}>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {t.deleteItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Alert>
          <Checkbox label={t.deleteCheck} checked={deleteChecked} onChange={(e) => setDeleteChecked(e.target.checked)} />
        </div>
      </Dialog>
    </>
  );
}
