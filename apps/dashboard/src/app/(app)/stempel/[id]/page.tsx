'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { ArrowLeft, KeyRound, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { BookingPolicy, DeviceDetailDto, DeviceStatus, LocationDto, ProgramDto } from '@tably/types';
import { Alert, api, ApiError, Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, defineCopy, DefinitionList, Dialog, EmptyState, ErrorState, Field, formatDateTime, formatRelative, Input, PageHeader, Select, Skeleton, Textarea, useCopy, useToast } from '@tably/ui';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { deviceKind, deviceSecurity, deviceStatus, policyLabel } from '@/lib/labels';
import { describeEvent, deviceEvent, isPhysical, securityHelp } from '@/components/devices/labels';
import { PersonalizationDialog } from '@/components/devices/personalization';
import { SimulateTapCard } from '@/components/devices/simulate-tap';

const copy = defineCopy({
  de: {
    back: 'Alle Stempel',
    notFoundTitle: 'Stempel nicht gefunden',
    notFoundText: 'Diesen Stempel gibt es nicht (mehr).',
    errorText: 'Der Stempel konnte nicht geladen werden.',
    simulationBadge: 'Simulation – nur für Tests',
    whatToDo: 'Was du tun kannst:',
    // Aktivierung
    activateTitle: 'So aktivierst du den Stempel',
    activateLead: 'Der Stempel ist registriert, aber noch nicht in Betrieb.',
    step1Title: 'Chip personalisieren',
    step1Text: 'Ein NTAG-424-DNA-Chip muss einmalig mit einem NFC-Schreibgerät beschrieben werden – das geht nicht mit dem Dashboard allein. Tably liefert dir dafür alle Werte: URL-Vorlage, Offsets und die beiden Schlüssel.',
    step1Owner: 'Die Personalisierungsdaten darf nur die Inhaberin oder der Inhaber bzw. eine Administratorin oder ein Administrator abrufen.',
    step2Title: 'Stempel einmal an ein Smartphone halten',
    step2Text: 'Der erste gültige Tap aktiviert den Stempel und verbindet ihn fest mit diesem Chip. Ab dann können Kunden Stempel sammeln.',
    showPersonalization: 'Personalisierungsdaten anzeigen',
    // Stammdaten
    baseTitle: 'Stammdaten',
    name: 'Name',
    nameRequired: 'Bitte gib dem Stempel einen Namen.',
    location: 'Standort',
    noLocation: 'Kein Standort',
    program: 'Treueprogramm',
    noProgram: 'Kein Programm zugeordnet',
    policy: 'Buchungsrichtlinie',
    policyInherit: 'Wie im Programm',
    policyInheritWith: (p: string) => `Wie im Programm (${p})`,
    policyInheritHint: 'Der Stempel übernimmt die Einstellung des Treueprogramms.',
    posUnavailable: 'nicht in deinem Tarif',
    save: 'Änderungen speichern',
    saved: 'Stempel gespeichert.',
    retiredReadOnly: 'Dieser Stempel ist außer Betrieb und kann nicht mehr geändert werden.',
    // Status
    statusTitle: 'Status',
    statusText: {
      PENDING: 'Der Stempel wartet auf seinen ersten gültigen Tap.',
      ACTIVE: 'Der Stempel ist in Betrieb und nimmt Taps an.',
      DISABLED: 'Der Stempel ist vorübergehend abgeschaltet. Taps werden abgelehnt.',
      LOST: 'Der Stempel wurde als verloren gemeldet. Taps werden abgelehnt.',
      RETIRED: 'Der Stempel ist endgültig außer Betrieb.',
    } as Record<DeviceStatus, string>,
    disable: 'Deaktivieren',
    disableTitle: 'Stempel deaktivieren?',
    disableText: 'Solange der Stempel deaktiviert ist, können Kunden damit keine Stempel sammeln. Du kannst ihn jederzeit wieder aktivieren.',
    disabledToast: 'Stempel deaktiviert.',
    enable: 'Wieder aktivieren',
    enableTitle: 'Stempel wieder aktivieren?',
    enableText: 'Der Stempel nimmt danach sofort wieder Taps an.',
    enabledToast: 'Stempel aktiviert.',
    lost: 'Als verloren melden',
    lostTitle: 'Stempel als verloren melden',
    lostText: 'Der Stempel wird sofort gesperrt: Niemand kann damit noch Stempel sammeln. Um den Chip später wieder zu nutzen, müssen die Schlüssel erneuert und der Chip neu personalisiert werden.',
    lostReason: 'Was ist passiert?',
    lostReasonHint: 'Die Begründung erscheint im Geräteprotokoll.',
    lostReasonPlaceholder: 'z. B. Seit Samstag nicht mehr an der Theke',
    lostReasonRequired: 'Bitte beschreibe kurz, was passiert ist.',
    lostConfirm: 'Verloren melden und sperren',
    lostToast: 'Stempel als verloren gemeldet und gesperrt.',
    retire: 'Außer Betrieb nehmen',
    retireTitle: 'Stempel endgültig außer Betrieb nehmen?',
    retireText: 'Das lässt sich nicht rückgängig machen. Der Stempel verschwindet aus der Liste und nimmt keine Taps mehr an. Bereits vergebene Stempel deiner Kunden bleiben erhalten.',
    retireConfirm: 'Endgültig außer Betrieb nehmen',
    retiredToast: 'Stempel außer Betrieb genommen.',
    cancel: 'Abbrechen',
    lostNeedsKeys: 'Zum Reaktivieren brauchst du neue Schlüssel (siehe „Schlüssel“).',
    // Sicherheit / Schlüssel
    securityTitle: 'Sicherheit',
    keysTitle: 'Schlüssel',
    keysTextPhysical: 'Jeder Stempel hat zwei geheime Schlüssel. Damit beweist der Chip bei jedem Tap, dass er echt ist.',
    keysTextSimulated: 'Auch der simulierte Stempel arbeitet mit geheimen Schlüsseln – genau wie ein echter Chip.',
    keysOwnerOnly: 'Schlüssel abrufen oder erneuern dürfen nur Inhaber:in und Administrator:in.',
    rotate: 'Schlüssel erneuern',
    rotateTitle: 'Schlüssel wirklich erneuern?',
    rotateTextPhysical: 'Der Stempel funktioniert danach sofort nicht mehr. Du musst den Chip mit den neuen Werten neu personalisieren und ihn durch einen Tap erneut aktivieren. Offene Taps verfallen.',
    rotateTextSimulated: 'Es werden neue Schlüssel erzeugt, bereits erzeugte Tap-Links werden ungültig. Der simulierte Stempel bleibt aktiv.',
    rotateConfirm: 'Ja, Schlüssel erneuern',
    rotatedToast: 'Neue Schlüssel erzeugt.',
    rotatedToastPhysical: 'Neue Schlüssel erzeugt. Bitte personalisiere den Chip jetzt neu.',
    // Kennzahlen
    statsTitle: 'Taps in den letzten 30 Tagen',
    tapsCompleted: 'Gutgeschrieben',
    tapsOpen: 'Offen (warten auf Freigabe oder Zuordnung)',
    tapsRejected: 'Abgelehnt',
    tapsExpired: 'Verfallen',
    invalidAttempts: 'Ungültige Leseversuche seit der letzten Schlüsselerneuerung',
    noTaps: 'In den letzten 30 Tagen gab es an diesem Stempel keine Taps.',
    // Technik
    techTitle: 'Technische Angaben',
    kind: 'Art',
    publicId: 'Gerätekennung',
    uid: 'Chip-Kennung (UID)',
    uidPending: 'wird beim ersten Tap gesetzt',
    keyVersion: 'Schlüsselversion',
    counter: 'Letzter Zählerstand',
    counterNone: 'noch kein Tap',
    lastUsed: 'Zuletzt verwendet',
    activatedAt: 'Aktiviert am',
    createdAt: 'Registriert am',
    // Protokoll
    logTitle: 'Geräteprotokoll',
    logText: 'Die letzten 50 Ereignisse an diesem Stempel.',
    logEmpty: 'Noch keine Einträge',
    unknownEvent: 'Sonstiges Ereignis',
    actionFailed: 'Das hat nicht geklappt.',
  },
});

type T = (typeof copy)['de'];
type Pending = null | 'disable' | 'enable' | 'lost' | 'retire' | 'rotate';

function ActivationCard({ t, canReveal, onReveal }: { t: T; canReveal: boolean; onReveal: () => void }) {
  return (
    <Card className="mb-6 border-warn/40">
      <CardHeader title={t.activateTitle} description={t.activateLead} />
      <CardBody>
        <ol className="flex flex-col gap-5">
          <li className="flex gap-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand" aria-hidden>
              1
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">{t.step1Title}</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted">{t.step1Text}</p>
              {canReveal ? (
                <Button variant="outline" size="sm" className="mt-3" onClick={onReveal}>
                  <KeyRound className="size-3.5" aria-hidden />
                  {t.showPersonalization}
                </Button>
              ) : (
                <p className="mt-2 text-sm text-muted">{t.step1Owner}</p>
              )}
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand" aria-hidden>
              2
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-ink">{t.step2Title}</h3>
              <p className="mt-1 max-w-2xl text-sm text-muted">{t.step2Text}</p>
            </div>
          </li>
        </ol>
      </CardBody>
    </Card>
  );
}

function BaseForm({ detail, t, posApi, onSaved }: { detail: DeviceDetailDto; t: T; posApi: boolean; onSaved: (d: DeviceDetailDto) => void }) {
  const { device } = detail;
  const toast = useToast();
  const locations = useSWR<LocationDto[]>('/organization/locations');
  const programs = useSWR<ProgramDto[]>('/programs');
  const [name, setName] = React.useState(device.name);
  const [locationId, setLocationId] = React.useState(device.locationId ?? '');
  const [programId, setProgramId] = React.useState(device.programId ?? '');
  const [policy, setPolicy] = React.useState<BookingPolicy | ''>(device.policyOverride ?? '');
  const [nameError, setNameError] = React.useState<string | null>(null);
  const readOnly = device.status === 'RETIRED';
  const form = useSubmit((body: { name: string; locationId: string | null; programId: string | null; policyOverride: BookingPolicy | null }) => api<DeviceDetailDto>(`/devices/${device.id}`, { method: 'PATCH', body }));

  const dirty = name.trim() !== device.name || locationId !== (device.locationId ?? '') || programId !== (device.programId ?? '') || policy !== (device.policyOverride ?? '');
  const locationOptions = (locations.data ?? []).filter((l) => l.isActive || l.id === device.locationId);
  const programOptions = (programs.data ?? []).filter((p) => p.status !== 'ARCHIVED' || p.id === device.programId);
  const selectedProgram = programOptions.find((p) => p.id === programId);
  const inheritedPolicy = selectedProgram?.bookingPolicy ?? (programId === device.programId ? device.program?.bookingPolicy : undefined);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(t.nameRequired);
      return;
    }
    setNameError(null);
    const saved = await form.submit({ name: name.trim(), locationId: locationId || null, programId: programId || null, policyOverride: policy || null });
    if (saved) {
      toast.success(t.saved);
      onSaved(saved);
    }
  }

  return (
    <Card>
      <CardHeader title={t.baseTitle} />
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          {readOnly ? <Alert tone="info">{t.retiredReadOnly}</Alert> : null}
          {form.error && Object.keys(form.fields).length === 0 ? <Alert tone="danger">{form.error}</Alert> : null}
          <Field label={t.name} error={nameError ?? form.fields.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={readOnly} autoComplete="off" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.location} error={form.fields.locationId}>
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={readOnly || !locations.data}>
                <option value="">{t.noLocation}</option>
                {/* Solange die Liste lädt, bleibt der aktuelle Wert sichtbar */}
                {!locations.data && device.location ? <option value={device.location.id}>{device.location.name}</option> : null}
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.program} error={form.fields.programId}>
              <Select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={readOnly || !programs.data}>
                <option value="">{t.noProgram}</option>
                {!programs.data && device.program ? <option value={device.program.id}>{device.program.name}</option> : null}
                {programOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t.policy} hint={policy ? policyLabel[policy].hint : t.policyInheritHint} error={form.fields.policyOverride}>
            <Select value={policy} onChange={(e) => setPolicy(e.target.value as BookingPolicy | '')} disabled={readOnly}>
              <option value="">{inheritedPolicy ? t.policyInheritWith(policyLabel[inheritedPolicy].label) : t.policyInherit}</option>
              {(Object.keys(policyLabel) as BookingPolicy[]).map((p) => {
                const unavailable = p === 'POS_EVENT' && !posApi && device.policyOverride !== 'POS_EVENT';
                return (
                  <option key={p} value={p} disabled={unavailable}>
                    {policyLabel[p].label}
                    {unavailable ? ` (${t.posUnavailable})` : ''}
                  </option>
                );
              })}
            </Select>
          </Field>
          {!readOnly ? (
            <div>
              <Button type="submit" loading={form.loading} disabled={!dirty}>
                {t.save}
              </Button>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

export default function DeviceDetailPage() {
  const t = useCopy(copy);
  const { id } = useParams<{ id: string }>();
  const { me, can } = useSession();
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const detail = useSWR<DeviceDetailDto, ApiError>(`/devices/${id}`);
  const [pending, setPending] = React.useState<Pending>(null);
  const [busy, setBusy] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [personalizationOpen, setPersonalizationOpen] = React.useState(false);

  const back = (
    <Link href="/stempel" className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
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
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </>
    );
  }

  const data = detail.data;
  const { device } = data;
  const physical = isPhysical(device);
  const simulated = device.kind === 'SIMULATED';
  const manageKeys = can('org.manage');
  const security = securityHelp[device.securityStatus];
  const retired = device.status === 'RETIRED';

  function applied(next: DeviceDetailDto) {
    void detail.mutate(next, { revalidate: false });
    void globalMutate('/devices');
  }

  async function run(action: () => Promise<DeviceDetailDto>, message: string) {
    setBusy(true);
    try {
      applied(await action());
      toast.success(message);
      setPending(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.actionFailed);
    } finally {
      setBusy(false);
    }
  }
  const setStatus = (status: 'ACTIVE' | 'DISABLED' | 'LOST' | 'RETIRED', message: string, why?: string) =>
    run(() => api<DeviceDetailDto>(`/devices/${device.id}/status`, { method: 'PUT', body: { status, ...(why ? { reason: why } : {}) } }), message);

  const canEnable = device.status === 'DISABLED' && Boolean(device.uidHex) && device.securityStatus !== 'COMPROMISED';
  const open30 = (data.taps30d.VERIFIED ?? 0) + (data.taps30d.PENDING_APPROVAL ?? 0) + (data.taps30d.PENDING_POS ?? 0);
  const totalTaps = Object.values(data.taps30d).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        back={back}
        title={device.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={deviceStatus[device.status].tone} dot>
              {deviceStatus[device.status].label}
            </Badge>
            <Badge tone={deviceSecurity[device.securityStatus].tone}>{deviceSecurity[device.securityStatus].label}</Badge>
            {simulated ? <Badge tone="honey">{t.simulationBadge}</Badge> : <span>{deviceKind[device.kind]}</span>}
          </span>
        }
      />

      {device.securityStatus !== 'OK' ? (
        <Alert tone={device.securityStatus === 'COMPROMISED' ? 'danger' : 'warn'} title={security.title} className="mb-6">
          <p>{security.text}</p>
          {security.todo ? (
            <p className="mt-2">
              <strong className="text-ink">{t.whatToDo}</strong> {security.todo}
            </p>
          ) : null}
        </Alert>
      ) : null}

      {physical && device.status === 'PENDING' ? <ActivationCard t={t} canReveal={manageKeys} onReveal={() => setPersonalizationOpen(true)} /> : null}

      {simulated && !retired ? (
        <div className="mb-6">
          <SimulateTapCard deviceId={device.id} enabled={data.simulatorEnabled} active={device.status === 'ACTIVE'} onTapped={() => void detail.mutate()} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <BaseForm key={`${device.id}:${device.name}:${device.locationId}:${device.programId}:${device.policyOverride}`} detail={data} t={t} posApi={Boolean(me.subscription?.features.posApi)} onSaved={applied} />

          <Card>
            <CardHeader title={t.logTitle} description={t.logText} />
            {data.events.length === 0 ? (
              <EmptyState title={t.logEmpty} className="py-10" />
            ) : (
              <CardBody className="pt-3">
                <ul className="divide-y divide-line">
                  {data.events.map((event) => {
                    const meta = deviceEvent[event.type];
                    const extra = describeEvent(event.type, event.detail);
                    return (
                      <li key={event.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-start sm:gap-4">
                        <div className="shrink-0 sm:w-48">
                          <Badge tone={meta?.tone ?? 'neutral'}>{meta?.label ?? t.unknownEvent}</Badge>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-muted">{meta?.hint ?? event.type}</p>
                          {extra ? <p className="mt-0.5 break-words text-ink">{extra}</p> : null}
                        </div>
                        <time dateTime={event.createdAt} title={formatDateTime(event.createdAt)} className="shrink-0 whitespace-nowrap text-xs text-subtle sm:w-28 sm:pt-0.5 sm:text-right">
                          {formatRelative(event.createdAt)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            )}
          </Card>
        </div>

        <div className="order-first flex min-w-0 flex-col gap-6 lg:order-last">
          <Card>
            <CardHeader title={t.statusTitle} description={t.statusText[device.status]} />
            <CardBody>
              {retired ? null : (
                <div className="flex flex-col items-stretch gap-2">
                  {device.status === 'ACTIVE' ? (
                    <Button variant="outline" onClick={() => setPending('disable')}>
                      {t.disable}
                    </Button>
                  ) : null}
                  {canEnable ? <Button onClick={() => setPending('enable')}>{t.enable}</Button> : null}
                  {device.status !== 'LOST' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReason('');
                        setReasonError(null);
                        setPending('lost');
                      }}
                    >
                      {t.lost}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted">{t.lostNeedsKeys}</p>
                  )}
                  <Button variant="ghost" className="text-danger" onClick={() => setPending('retire')}>
                    {t.retire}
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {device.securityStatus === 'OK' ? <ShieldCheck className="size-4 text-success" aria-hidden /> : <ShieldAlert className="size-4 text-warn" aria-hidden />}
                  {t.securityTitle}
                </span>
              }
              description={
                <>
                  <strong className="font-medium text-ink">{security.title}.</strong> {device.securityStatus === 'OK' ? security.text : null}
                </>
              }
            />
            <CardBody>
              <h3 className="text-sm font-semibold text-ink">{t.keysTitle}</h3>
              <p className="mt-1 text-sm text-muted">{physical ? t.keysTextPhysical : t.keysTextSimulated}</p>
              {retired ? null : manageKeys ? (
                <div className="mt-4 flex flex-col items-stretch gap-2">
                  {physical ? (
                    <Button variant="outline" onClick={() => setPersonalizationOpen(true)}>
                      <KeyRound className="size-4" aria-hidden />
                      {t.showPersonalization}
                    </Button>
                  ) : null}
                  {device.kind !== 'ACTIVE_READER' ? (
                    <Button variant="outline" onClick={() => setPending('rotate')}>
                      <RefreshCw className="size-4" aria-hidden />
                      {t.rotate}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">{t.keysOwnerOnly}</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.statsTitle} />
            <CardBody className="pt-3">
              {totalTaps === 0 ? <p className="mb-2 text-sm text-muted">{t.noTaps}</p> : null}
              <DefinitionList
                items={[
                  { label: t.tapsCompleted, value: <span className="tabular">{(data.taps30d.COMPLETED ?? 0).toLocaleString('de-DE')}</span> },
                  { label: t.tapsOpen, value: <span className="tabular">{open30.toLocaleString('de-DE')}</span> },
                  { label: t.tapsRejected, value: <span className="tabular">{(data.taps30d.REJECTED ?? 0).toLocaleString('de-DE')}</span> },
                  { label: t.tapsExpired, value: <span className="tabular">{(data.taps30d.EXPIRED ?? 0).toLocaleString('de-DE')}</span> },
                  { label: t.invalidAttempts, value: <span className="tabular">{device.rejectedTaps.toLocaleString('de-DE')}</span> },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.techTitle} />
            <CardBody className="pt-3">
              <DefinitionList
                items={[
                  { label: t.kind, value: deviceKind[device.kind] },
                  { label: t.publicId, value: <span className="break-all font-mono text-xs">{device.publicId}</span> },
                  { label: t.uid, value: device.uidHex ? <span className="break-all font-mono text-xs">{device.uidHex}</span> : <span className="font-normal text-muted">{t.uidPending}</span> },
                  { label: t.keyVersion, value: device.keyVersion },
                  { label: t.counter, value: device.lastCounter >= 0 ? device.lastCounter.toLocaleString('de-DE') : <span className="font-normal text-muted">{t.counterNone}</span> },
                  { label: t.lastUsed, value: formatRelative(device.lastUsedAt) },
                  { label: t.activatedAt, value: formatDateTime(device.activatedAt) },
                  { label: t.createdAt, value: formatDateTime(device.createdAt) },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog open={pending === 'disable'} onOpenChange={(o) => !o && setPending(null)} title={t.disableTitle} description={t.disableText} confirmLabel={t.disable} loading={busy} onConfirm={() => setStatus('DISABLED', t.disabledToast)} />
      <ConfirmDialog open={pending === 'enable'} onOpenChange={(o) => !o && setPending(null)} title={t.enableTitle} description={t.enableText} confirmLabel={t.enable} loading={busy} onConfirm={() => setStatus('ACTIVE', t.enabledToast)} />
      <ConfirmDialog open={pending === 'retire'} onOpenChange={(o) => !o && setPending(null)} title={t.retireTitle} description={t.retireText} confirmLabel={t.retireConfirm} danger loading={busy} onConfirm={() => setStatus('RETIRED', t.retiredToast)} />
      <ConfirmDialog
        open={pending === 'rotate'}
        onOpenChange={(o) => !o && setPending(null)}
        title={t.rotateTitle}
        description={physical ? t.rotateTextPhysical : t.rotateTextSimulated}
        confirmLabel={t.rotateConfirm}
        danger
        loading={busy}
        onConfirm={() => run(() => api<DeviceDetailDto>(`/devices/${device.id}/rotate-keys`, { method: 'POST' }), physical ? t.rotatedToastPhysical : t.rotatedToast)}
      />
      <Dialog
        open={pending === 'lost'}
        onOpenChange={(o) => !o && setPending(null)}
        title={t.lostTitle}
        description={t.lostText}
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)}>
              {t.cancel}
            </Button>
            <Button type="submit" form="lost-form" variant="danger" loading={busy}>
              {t.lostConfirm}
            </Button>
          </>
        }
      >
        <form
          id="lost-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason.trim()) {
              setReasonError(t.lostReasonRequired);
              return;
            }
            setReasonError(null);
            void setStatus('LOST', t.lostToast, reason.trim());
          }}
        >
          <Field label={t.lostReason} hint={t.lostReasonHint} error={reasonError}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={t.lostReasonPlaceholder} />
          </Field>
        </form>
      </Dialog>

      {physical && manageKeys ? <PersonalizationDialog deviceId={device.id} open={personalizationOpen} onOpenChange={setPersonalizationOpen} onRevealed={() => void detail.mutate()} /> : null}
    </>
  );
}
