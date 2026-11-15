'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { ArrowLeft, Pause, Pencil, Play, Square, Trash2 } from 'lucide-react';
import type { CampaignDetailDto, ProgramDto, WalletStatusDto } from '@tably/types';
import { Alert, api, ApiError, Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, defineCopy, DefinitionList, EmptyState, ErrorState, formatDateTime, fullName, PageHeader, Skeleton, Table, Td, Th, useCopy, useToast } from '@tably/ui';
import { useSession } from '@/lib/session';
import { campaignStatus, campaignType, channelLabel } from '@/lib/labels';
import { CampaignForm } from '@/components/marketing/campaign-form';
import { DeliveryBanner } from '@/components/marketing/delivery-banner';
import { describeSegment, describeStats, isRunningType, notificationStatus, skipReason, WEEKDAYS } from '@/components/marketing/labels';

const copy = defineCopy({
  de: {
    back: 'Alle Kampagnen',
    notFoundTitle: 'Kampagne nicht gefunden',
    notFoundText: 'Diese Kampagne gibt es nicht (mehr).',
    errorText: 'Die Kampagne konnte nicht geladen werden.',
    edit: 'Bearbeiten',
    editTitle: 'Kampagne bearbeiten',
    saved: 'Kampagne gespeichert.',
    launch: 'Starten',
    launchTitle: 'Kampagne jetzt starten?',
    launchOnceNow: 'Die Nachricht wird sofort an alle Kunden der Zielgruppe verschickt, die dem jeweiligen Kanal zugestimmt haben. Das lässt sich nicht zurückholen.',
    launchOnceLater: (when: string) => `Die Nachricht wird am ${when} automatisch verschickt. Bis dahin kannst du die Kampagne pausieren.`,
    launchRunning: 'Die Kampagne läuft ab sofort automatisch, bis du sie pausierst oder beendest.',
    launchLocal: 'Testmodus: E-Mails werden nicht wirklich versendet, sondern nur protokolliert.',
    launchConfirm: 'Jetzt starten',
    launched: 'Kampagne gestartet.',
    pause: 'Pausieren',
    paused: 'Kampagne pausiert.',
    resume: 'Fortsetzen',
    resumed: 'Kampagne läuft wieder.',
    end: 'Beenden',
    endTitle: 'Kampagne beenden?',
    endText: 'Die Kampagne wird endgültig beendet und verschwindet von den Karten deiner Kunden. Sie lässt sich danach nicht wieder starten.',
    ended: 'Kampagne beendet.',
    remove: 'Löschen',
    removeTitle: 'Entwurf löschen?',
    removeText: 'Der Entwurf wird endgültig gelöscht.',
    removed: 'Entwurf gelöscht.',
    actionFailed: 'Das hat nicht geklappt.',
    statusHint: {
      DRAFT: 'Entwurf – es wurde noch nichts versendet. Prüfe die Angaben und starte dann.',
      SCHEDULED: 'Der Versand ist eingeplant.',
      SENDING: 'Der Versand läuft gerade. Diese Seite aktualisiert sich von selbst.',
      SENT: 'Der Versand ist abgeschlossen.',
      ACTIVE: 'Die Kampagne läuft automatisch.',
      PAUSED: 'Die Kampagne ist pausiert. Solange passiert nichts.',
      ENDED: 'Die Kampagne ist beendet.',
      FAILED: 'Beim Versand ist ein Fehler aufgetreten. Im Versandprotokoll siehst du, was bereits verschickt wurde.',
    } as Record<string, string>,
    scheduledEdit: 'Wenn du noch etwas ändern möchtest, pausiere die Kampagne zuerst.',
    sentVisible: 'Hinweise auf der Webkarte und in der Wallet bleiben sichtbar, bis du die Kampagne beendest.',
    summaryTitle: 'Zusammenfassung',
    type: 'Typ',
    channels: 'Kanäle',
    audience: 'Zielgruppe',
    audienceAll: 'Alle aktiven Kunden',
    audienceOccasion: { BIRTHDAY: 'Kunden an ihrem Geburtstag', INACTIVITY: (d: number) => `Kunden nach ${d} Tagen ohne Besuch` },
    program: 'Gilt für',
    allPrograms: 'Alle Programme',
    settings: 'Einstellungen',
    bonusStamps: (n: number) => (n === 0 ? 'Kein Bonusstempel' : n === 1 ? '1 Bonusstempel' : `${n} Bonusstempel`),
    multiplier: (n: number) => `Stempel zählen ×${n}`,
    everyDay: 'an jedem Tag',
    schedule: 'Zeitplan',
    sendOnLaunch: 'Versand sofort beim Starten',
    sendAt: (when: string) => `Versand am ${when}`,
    sentAt: (when: string) => `Gesendet am ${when}`,
    from: (when: string) => `ab ${when}`,
    until: (when: string) => `bis ${when}`,
    untilEnded: 'bis du sie beendest',
    fromLaunch: 'ab dem Start',
    createdAt: 'Angelegt am',
    messageTitle: 'Nachricht',
    noBody: 'Kein Text hinterlegt.',
    placeholderNote: '{{vorname}} wird beim Versand durch den Vornamen ersetzt.',
    statsTitle: 'Ergebnis',
    statsBonus: 'Diese Aktion verschickt keine Nachrichten. Sie wirkt direkt beim Stempeln und steht auf der Webkarte.',
    logTitle: 'Versandprotokoll',
    logText: 'Die letzten 50 Einträge.',
    logEmpty: 'Noch kein Versand',
    logEmptyText: 'Sobald Nachrichten verschickt oder übersprungen werden, erscheinen sie hier.',
    colRecipient: 'Empfänger',
    colChannel: 'Kanal',
    colStatus: 'Status',
    colNote: 'Hinweis',
    colTime: 'Zeit',
    unknownCustomer: 'Gelöschter Kunde',
    testNote: 'Nur protokolliert, nicht versendet',
  },
});

type Pending = null | 'launch' | 'end' | 'remove';

export default function CampaignDetailPage() {
  const t = useCopy(copy);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me, can } = useSession();
  const { mutate: globalMutate } = useSWRConfig();
  const [removed, setRemoved] = React.useState(false);
  const detail = useSWR<CampaignDetailDto, ApiError>(removed ? null : `/campaigns/${id}`, {
    // Während des Versands regelmäßig nachladen, bis das Ergebnis feststeht.
    refreshInterval: (data) => (data && (data.status === 'SENDING' || (data.status === 'SCHEDULED' && (!data.scheduledAt || new Date(data.scheduledAt).getTime() < Date.now() + 60_000))) ? 2000 : 0),
  });
  const programs = useSWR<ProgramDto[]>('/programs');
  const wallet = useSWR<WalletStatusDto>('/wallet/status');
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState<Pending>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const back = (
    <Link href="/marketing" className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden />
      {t.back}
    </Link>
  );

  if (detail.error) {
    return (
      <>
        <PageHeader title={t.notFoundTitle} back={back} />
        <Card>{detail.error.status === 404 ? <EmptyState title={t.notFoundTitle} description={t.notFoundText} /> : <ErrorState description={t.errorText} onRetry={() => void detail.mutate()} />}</Card>
      </>
    );
  }
  if (!detail.data) {
    return (
      <>
        <div className="mb-8">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-8 w-72" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </>
    );
  }

  const c = detail.data;
  const running = isRunningType(c.type);
  const programName = (pid: string | null) => (pid ? (programs.data?.find((p) => p.id === pid)?.name ?? null) : null);

  function applied(next: CampaignDetailDto) {
    void detail.mutate(next, { revalidate: false });
    void globalMutate('/campaigns');
  }
  async function act(action: 'launch' | 'pause' | 'resume' | 'end', message: string) {
    setBusy(action);
    try {
      applied(await api<CampaignDetailDto>(`/campaigns/${c.id}/${action}`, { method: 'POST' }));
      toast.success(message);
      setPending(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.actionFailed);
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    setBusy('remove');
    try {
      await api(`/campaigns/${c.id}`, { method: 'DELETE' });
      setRemoved(true);
      toast.success(t.removed);
      void globalMutate('/campaigns');
      router.push('/marketing');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.actionFailed);
      setBusy(null);
    }
  }

  if (editing) {
    return (
      <>
        <PageHeader title={t.editTitle} description={c.name} back={back} />
        <div className="max-w-4xl">
          <CampaignForm
            initial={c}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              applied(saved);
              toast.success(t.saved);
              setEditing(false);
              window.scrollTo({ top: 0 });
            }}
          />
        </div>
      </>
    );
  }

  const manage = can('campaigns.manage');
  // Geplante Kampagnen erst pausieren: so kollidiert keine Änderung mit dem eingeplanten Versand.
  const editable = ['DRAFT', 'PAUSED'].includes(c.status);
  const scheduledFuture = c.scheduledAt && new Date(c.scheduledAt).getTime() > Date.now() + 30_000;
  const actions = manage ? (
    <>
      {editable ? (
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-4" aria-hidden />
          {t.edit}
        </Button>
      ) : null}
      {c.status === 'DRAFT' ? (
        <Button variant="outline" onClick={() => setPending('remove')}>
          <Trash2 className="size-4" aria-hidden />
          {t.remove}
        </Button>
      ) : null}
      {c.status === 'ACTIVE' || c.status === 'SCHEDULED' ? (
        <Button variant="outline" loading={busy === 'pause'} onClick={() => void act('pause', t.paused)}>
          <Pause className="size-4" aria-hidden />
          {t.pause}
        </Button>
      ) : null}
      {['ACTIVE', 'PAUSED', 'SENT'].includes(c.status) ? (
        <Button variant="outline" onClick={() => setPending('end')}>
          <Square className="size-4" aria-hidden />
          {t.end}
        </Button>
      ) : null}
      {c.status === 'PAUSED' && running ? (
        <Button loading={busy === 'resume'} onClick={() => void act('resume', t.resumed)}>
          <Play className="size-4" aria-hidden />
          {t.resume}
        </Button>
      ) : null}
      {c.status === 'DRAFT' || (c.status === 'PAUSED' && !running) ? (
        <Button onClick={() => setPending('launch')}>
          <Play className="size-4" aria-hidden />
          {t.launch}
        </Button>
      ) : null}
    </>
  ) : undefined;

  const segmentParts = describeSegment(running ? { ...c.segment, inactiveDays: null, activeDays: null } : c.segment, programName(c.segment.programId));
  const occasion = c.type === 'BIRTHDAY' ? t.audienceOccasion.BIRTHDAY : c.type === 'INACTIVITY' ? t.audienceOccasion.INACTIVITY(c.config.inactivityDays) : null;
  const weekdayText = c.config.weekdays.length === 0 ? t.everyDay : WEEKDAYS.filter((d) => c.config.weekdays.includes(d.value)).map((d) => d.short).join(', ');
  const settings = c.type === 'BIRTHDAY' || c.type === 'INACTIVITY' ? t.bonusStamps(c.config.bonusStamps) : c.type === 'BONUS_STAMPS' ? `${t.multiplier(c.config.multiplier)} · ${weekdayText}` : null;
  const schedule =
    c.type === 'BONUS_STAMPS' || (running && c.startsAt)
      ? `${c.startsAt ? t.from(formatDateTime(c.startsAt)) : t.fromLaunch}, ${c.endsAt ? t.until(formatDateTime(c.endsAt)) : t.untilEnded}`
      : running
        ? `${t.fromLaunch}, ${t.untilEnded}`
        : `${c.sentAt ? t.sentAt(formatDateTime(c.sentAt)) : scheduledFuture ? t.sendAt(formatDateTime(c.scheduledAt)) : t.sendOnLaunch}${c.endsAt ? ` · sichtbar ${t.until(formatDateTime(c.endsAt))}` : ''}`;

  const summary = [
    { label: t.type, value: campaignType[c.type].label },
    ...(c.type === 'BONUS_STAMPS' ? [{ label: t.program, value: programName(c.programId) ?? t.allPrograms }] : [{ label: t.channels, value: c.channels.map((ch) => channelLabel[ch] ?? ch).join(', ') }]),
    ...(c.type !== 'BONUS_STAMPS'
      ? [
          {
            label: t.audience,
            value: (
              <span className="block">
                {occasion ?? (segmentParts.length === 0 ? t.audienceAll : null)}
                {segmentParts.length > 0 ? <span className="block font-normal text-muted">{segmentParts.join(' · ')}</span> : null}
              </span>
            ),
          },
        ]
      : []),
    ...(settings ? [{ label: t.settings, value: settings }] : []),
    { label: t.schedule, value: schedule },
    { label: t.createdAt, value: formatDateTime(c.createdAt) },
  ];

  return (
    <>
      <PageHeader
        back={back}
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={campaignStatus[c.status].tone} dot>
              {campaignStatus[c.status].label}
            </Badge>
            <span>{campaignType[c.type].label}</span>
          </span>
        }
        actions={actions}
      />

      <Alert tone={c.status === 'FAILED' ? 'danger' : c.status === 'PAUSED' ? 'warn' : 'info'} className="mb-4">
        {c.status === 'SCHEDULED' && scheduledFuture ? `${t.sendAt(formatDateTime(c.scheduledAt))}. ${t.scheduledEdit}` : (t.statusHint[c.status] ?? '')}
        {c.status === 'SENT' && (c.channels.includes('CARD') || c.channels.includes('WALLET')) ? ` ${t.sentVisible}` : ''}
      </Alert>
      {c.type !== 'BONUS_STAMPS' ? <DeliveryBanner className="mb-6" mailMode={c.channels.includes('EMAIL') ? c.mailMode : undefined} wallet={wallet.data} walletError={Boolean(wallet.error)} emailFeature={Boolean(me.subscription?.features.emailCampaigns)} /> : <div className="mb-6" />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title={t.messageTitle} />
            <CardBody>
              <div className="rounded-xl bg-sunken p-4">
                <p className="font-semibold text-ink">{c.subject || '–'}</p>
                {c.body ? <p className="mt-2 whitespace-pre-line break-words text-sm text-ink">{c.body}</p> : <p className="mt-2 text-sm text-muted">{t.noBody}</p>}
              </div>
              {/\{\{\s*vorname\s*\}\}/i.test(c.body) ? <p className="mt-2 text-xs text-muted">{t.placeholderNote}</p> : null}
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title={t.logTitle} description={c.notifications.length > 0 ? t.logText : undefined} />
            {c.notifications.length === 0 ? (
              <EmptyState title={t.logEmpty} description={c.type === 'BONUS_STAMPS' ? t.statsBonus : t.logEmptyText} className="py-10" />
            ) : (
              <>
              <ul className="mt-3 divide-y divide-line border-t border-line md:hidden">
                {c.notifications.map((n) => {
                  const status = notificationStatus[n.status];
                  const note = n.status === 'SKIPPED' ? (skipReason[n.error ?? ''] ?? n.error) : n.status === 'SENT_TEST' ? t.testNote : n.error;
                  return (
                    <li key={n.id} className="px-5 py-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 truncate font-medium text-ink">{n.customer ? fullName(n.customer) : t.unknownCustomer}</span>
                        <Badge tone={status?.tone ?? 'neutral'}>{status?.label ?? n.status}</Badge>
                      </div>
                      {n.recipient ? <p className="truncate text-xs text-muted">{n.recipient}</p> : null}
                      <p className="mt-1 text-muted">
                        {channelLabel[n.channel] ?? n.channel}
                        {note ? ` · ${note}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-subtle">{formatDateTime(n.sentAt ?? n.createdAt)}</p>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 hidden md:block">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t.colRecipient}</Th>
                      <Th>{t.colChannel}</Th>
                      <Th>{t.colStatus}</Th>
                      <Th>{t.colNote}</Th>
                      <Th>{t.colTime}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.notifications.map((n) => {
                      const status = notificationStatus[n.status];
                      const note = n.status === 'SKIPPED' ? (skipReason[n.error ?? ''] ?? n.error) : n.status === 'SENT_TEST' ? t.testNote : n.error;
                      return (
                        <tr key={n.id}>
                          <Td>
                            {n.customer ? (
                              can('customers.read') ? (
                                <Link href={`/kunden/${n.customer.id}`} className="font-medium hover:underline">
                                  {fullName(n.customer)}
                                </Link>
                              ) : (
                                <span className="font-medium">{fullName(n.customer)}</span>
                              )
                            ) : (
                              <span className="text-muted">{t.unknownCustomer}</span>
                            )}
                            {n.recipient ? <span className="block max-w-44 truncate text-xs text-muted" title={n.recipient}>{n.recipient}</span> : null}
                          </Td>
                          <Td className="whitespace-nowrap text-muted">{channelLabel[n.channel] ?? n.channel}</Td>
                          <Td>
                            <Badge tone={status?.tone ?? 'neutral'}>{status?.label ?? n.status}</Badge>
                          </Td>
                          <Td className="min-w-40 text-muted">{note ?? '–'}</Td>
                          <Td className="whitespace-nowrap text-muted">{formatDateTime(n.sentAt ?? n.createdAt)}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              </>
            )}
          </Card>
        </div>

        <div className="order-first flex min-w-0 flex-col gap-6 lg:order-last">
          <Card>
            <CardHeader title={t.summaryTitle} />
            <CardBody className="pt-3">
              <DefinitionList items={summary} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t.statsTitle} />
            <CardBody>
              {c.type === 'BONUS_STAMPS' ? (
                <p className="text-sm text-muted">{t.statsBonus}</p>
              ) : (
                <dl className="grid grid-cols-2 gap-2">
                  {describeStats(c.stats).map((s) => (
                    <div key={s.label} className="rounded-xl bg-sunken px-3 py-2.5">
                      <dd className="text-2xl font-semibold text-ink tabular">{s.value.toLocaleString('de-DE')}</dd>
                      <dt className="text-xs text-muted">{s.label}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={pending === 'launch'}
        onOpenChange={(o) => !o && setPending(null)}
        title={t.launchTitle}
        description={`${running ? t.launchRunning : scheduledFuture ? t.launchOnceLater(formatDateTime(c.scheduledAt)) : t.launchOnceNow}${c.mailMode === 'local' && c.channels.includes('EMAIL') ? ` ${t.launchLocal}` : ''}`}
        confirmLabel={t.launchConfirm}
        loading={busy === 'launch'}
        onConfirm={() => act('launch', t.launched)}
      />
      <ConfirmDialog open={pending === 'end'} onOpenChange={(o) => !o && setPending(null)} title={t.endTitle} description={t.endText} confirmLabel={t.end} danger loading={busy === 'end'} onConfirm={() => act('end', t.ended)} />
      <ConfirmDialog open={pending === 'remove'} onOpenChange={(o) => !o && setPending(null)} title={t.removeTitle} description={t.removeText} confirmLabel={t.remove} danger loading={busy === 'remove'} onConfirm={remove} />
    </>
  );
}
