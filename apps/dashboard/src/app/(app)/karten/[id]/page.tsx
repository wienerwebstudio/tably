'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import type { BookingPolicy, CardDesign, ProgramDto, RewardDto } from '@tapperl/types';
import {
  Alert, api, ApiError, Badge, Button, Card, CardBody, CardHeader, cn, ConfirmDialog, CopyButton, defineCopy, Dialog, ErrorState, Field, Input, PageHeader, Skeleton, Switch, TabPanel, Tabs, Textarea, useCopy, useToast,
} from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { policyLabel, programStatus } from '@/lib/labels';
import { useSubmit } from '@/lib/use-submit';
import { CardPreviews, QrImage } from '@/components/programs/previews';
import { ColorField, IconPicker, StampCountField } from '@/components/programs/design-fields';
import { contrastRatio } from '@/components/programs/presets';

const copy = defineCopy({
  de: {
    back: 'Treuekarten',
    save: 'Änderungen speichern',
    saved: 'Gespeichert',
    unsaved: 'Ungespeicherte Änderungen',
    publish: 'Veröffentlichen',
    pause: 'Pausieren',
    resume: 'Wieder aktivieren',
    archive: 'Archivieren',
    archiveTitle: 'Karte archivieren?',
    archiveText: 'Kund:innen können dann keine Stempel mehr sammeln. Bestehende Daten bleiben erhalten. Das lässt sich nicht rückgängig machen.',
    published: 'Die Karte ist veröffentlicht.',
    tabs: { design: 'Gestaltung', rewards: 'Prämien', rules: 'Regeln', share: 'Teilen' },
    cardTitle: 'Titel auf der Karte',
    name: 'Interner Name',
    description: 'Beschreibung',
    descriptionHint: 'Erscheint auf der Anmeldeseite.',
    background: 'Hintergrund',
    text: 'Schrift',
    accent: 'Akzent (Stempel)',
    lowContrast: 'Schrift und Hintergrund sind sich sehr ähnlich – die Karte ist schwer lesbar.',
    lowAccent: 'Die Stempel heben sich kaum vom Hintergrund ab.',
    showLogo: 'Logo anzeigen',
    showLogoHint: 'Das Logo deines Betriebs lädst du unter Einstellungen → Betrieb hoch.',
    rewardText: 'Prämientext auf der Karte',
    rewardTextHint: 'Leer lassen, um den Namen der Hauptprämie zu zeigen.',
    footerText: 'Fußzeile',
    terms: 'Teilnahmebedingungen',
    rewardsTitle: 'Prämien',
    rewardsText: 'Wofür können Stempel eingelöst werden?',
    addReward: 'Prämie hinzufügen',
    rewardName: 'Name',
    rewardDescription: 'Beschreibung',
    rewardCost: 'Kosten in Stempeln',
    noRewards: 'Noch keine Prämie. Ohne Prämie kann die Karte nicht veröffentlicht werden.',
    deleteReward: 'Prämie entfernen?',
    policy: 'Wie werden Stempel vergeben?',
    policyNote: 'Ein NFC-Tap beweist, dass der Stempel ans Handy gehalten wurde – nicht, dass etwas gekauft wurde. Wähle die Absicherung, die zu deinem Betrieb passt.',
    posNeedsPlan: 'Benötigt die Kassen-Schnittstelle (Premium-Tarif).',
    minInterval: 'Mindestabstand zwischen zwei Stempeln (Minuten)',
    minIntervalHint: 'Verhindert, dass dieselbe Karte mehrfach hintereinander gestempelt wird. 0 = kein Mindestabstand.',
    maxPerDay: 'Höchstens Stempel pro Karte und Tag',
    perTap: 'Stempel pro Tap',
    signupBonus: 'Willkommensstempel bei Anmeldung',
    validFrom: 'Programm läuft ab',
    validUntil: 'Programm endet am',
    cardValidity: 'Karten verfallen nach Tagen',
    cardValidityHint: 'Leer lassen, wenn Karten nicht verfallen sollen.',
    shareTitle: 'Anmeldelink',
    shareText: 'Über diesen Link legen Kund:innen ihre Karte an. Drucke den QR-Code aus und stell ihn an die Theke.',
    notPublished: 'Die Karte ist noch nicht veröffentlicht – der Link funktioniert erst danach.',
    open: 'Anmeldeseite öffnen',
    downloadQr: 'QR-Code herunterladen',
  },
});

type TabKey = 'design' | 'rewards' | 'rules' | 'share';

interface Draft {
  name: string;
  cardTitle: string;
  description: string;
  stampsRequired: number;
  stampsPerTap: number;
  stampIcon: string;
  design: CardDesign;
  bookingPolicy: BookingPolicy;
  minIntervalMinutes: number;
  maxStampsPerDay: number;
  signupBonus: number;
  validFrom: string;
  validUntil: string;
  cardValidityDays: string;
  terms: string;
}

const dateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function toDraft(p: ProgramDto): Draft {
  return {
    name: p.name,
    cardTitle: p.cardTitle,
    description: p.description,
    stampsRequired: p.stampsRequired,
    stampsPerTap: p.stampsPerTap,
    stampIcon: p.stampIcon,
    design: p.design,
    bookingPolicy: p.bookingPolicy,
    minIntervalMinutes: p.minIntervalMinutes,
    maxStampsPerDay: p.maxStampsPerDay,
    signupBonus: p.signupBonus,
    validFrom: dateInput(p.validFrom),
    validUntil: dateInput(p.validUntil),
    cardValidityDays: p.cardValidityDays ? String(p.cardValidityDays) : '',
    terms: p.terms,
  };
}

function RewardDialog({ programId, reward, open, onOpenChange, onSaved, unit }: { programId: string; reward: RewardDto | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; unit: string }) {
  const t = useCopy(copy);
  const toast = useToast();
  const form = useSubmit(async (data: FormData) => {
    const body = { name: data.get('name'), description: data.get('description') ?? '', cost: Number(data.get('cost')) };
    if (reward) await api(`/programs/${programId}/rewards/${reward.id}`, { method: 'PATCH', body });
    else await api(`/programs/${programId}/rewards`, { body });
    toast.success(t.saved);
    onSaved();
    onOpenChange(false);
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={reward ? reward.name : t.addReward}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button type="submit" form="reward-form" loading={form.loading}>Speichern</Button>
        </>
      }
    >
      <form method="post" id="reward-form" className="flex flex-col gap-4" onSubmit={(e) => (e.preventDefault(), void form.submit(new FormData(e.currentTarget)))} noValidate>
        {form.error ? <Alert tone="danger">{form.error}</Alert> : null}
        <Field label={t.rewardName} error={form.fields.name}>
          <Input name="name" defaultValue={reward?.name ?? ''} maxLength={60} required autoFocus />
        </Field>
        <Field label={t.rewardDescription} optional error={form.fields.description}>
          <Input name="description" defaultValue={reward?.description ?? ''} maxLength={200} />
        </Field>
        <Field label={t.rewardCost.replace('Stempeln', unit === 'Punkte' ? 'Punkten' : 'Stempeln')} error={form.fields.cost}>
          <Input name="cost" type="number" inputMode="numeric" min={1} defaultValue={reward?.cost ?? 10} required className="max-w-28" />
        </Field>
      </form>
    </Dialog>
  );
}

export default function ProgramDesignerPage() {
  const t = useCopy(copy);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me, can } = useSession();
  const editable = can('programs.manage');
  const { data: program, error, mutate } = useSWR<ProgramDto, ApiError>(`/programs/${id}`);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [tab, setTab] = React.useState<TabKey>('design');
  const [rewardDialog, setRewardDialog] = React.useState<{ open: boolean; reward: RewardDto | null }>({ open: false, reward: null });
  const [removeReward, setRemoveReward] = React.useState<RewardDto | null>(null);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(false);

  // Entwurf nur beim ersten Laden bzw. nach dem Speichern aus den Serverdaten übernehmen.
  const loadedVersion = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (program && loadedVersion.current !== program.id) {
      loadedVersion.current = program.id;
      setDraft(toDraft(program));
    }
  }, [program]);

  const dirty = Boolean(program && draft && JSON.stringify(toDraft(program)) !== JSON.stringify(draft));
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useSubmit(async () => {
    if (!draft) return;
    const updated = await api<ProgramDto>(`/programs/${id}`, {
      method: 'PATCH',
      body: {
        ...draft,
        validFrom: draft.validFrom ? new Date(`${draft.validFrom}T00:00:00`).toISOString() : null,
        validUntil: draft.validUntil ? new Date(`${draft.validUntil}T23:59:59`).toISOString() : null,
        cardValidityDays: draft.cardValidityDays ? Number(draft.cardValidityDays) : null,
      },
    });
    await mutate(updated, { revalidate: false });
    setDraft(toDraft(updated));
    toast.success(t.saved);
  });

  async function setStatus(status: 'PUBLISHED' | 'PAUSED' | 'ARCHIVED') {
    setStatusLoading(true);
    try {
      const updated = await api<ProgramDto>(`/programs/${id}/status`, { method: 'PUT', body: { status } });
      await mutate(updated, { revalidate: false });
      if (status === 'ARCHIVED') router.replace('/karten');
      else toast.success(status === 'PUBLISHED' ? t.published : t.saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Fehler');
      if (err instanceof ApiError && err.fields.reward) setTab('rewards');
    } finally {
      setStatusLoading(false);
      setArchiveOpen(false);
    }
  }

  if (error) return <Card><ErrorState title={error.status === 404 ? 'Karte nicht gefunden' : undefined} onRetry={error.status === 404 ? undefined : () => void mutate()} /></Card>;
  if (!program || !draft) {
    return (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[32rem] rounded-2xl" />
        <Skeleton className="h-[32rem] rounded-2xl" />
      </div>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const setDesign = <K extends keyof CardDesign>(key: K, value: CardDesign[K]) => setDraft((d) => (d ? { ...d, design: { ...d.design, [key]: value } } : d));
  const unit = program.preview.unitLabel;
  const activeRewards = program.rewards.filter((r) => r.isActive !== false);
  const posAvailable = Boolean(me.subscription?.features.posApi);
  const number = (key: 'minIntervalMinutes' | 'maxStampsPerDay' | 'stampsPerTap' | 'signupBonus', min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, Math.max(min, Math.min(max, Number(e.currentTarget.value) || min)));

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{program.name} <Badge tone={programStatus[program.status].tone} dot>{programStatus[program.status].label}</Badge></span>}
        back={<Link href="/karten" className="inline-flex items-center gap-1 text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> {t.back}</Link>}
        actions={
          editable ? (
            <>
              {program.status === 'DRAFT' ? <Button variant="honey" loading={statusLoading} disabled={dirty} onClick={() => void setStatus('PUBLISHED')}>{t.publish}</Button> : null}
              {program.status === 'PUBLISHED' ? <Button variant="outline" loading={statusLoading} onClick={() => void setStatus('PAUSED')}>{t.pause}</Button> : null}
              {program.status === 'PAUSED' ? <Button variant="outline" loading={statusLoading} onClick={() => void setStatus('PUBLISHED')}>{t.resume}</Button> : null}
              {program.status !== 'ARCHIVED' ? <Button variant="ghost" className="text-danger" onClick={() => setArchiveOpen(true)}>{t.archive}</Button> : null}
              <Button loading={save.loading} disabled={!dirty} onClick={() => void save.submit()}>{t.save}</Button>
            </>
          ) : undefined
        }
      />
      {save.error ? <Alert tone="danger" className="mb-6">{save.error}</Alert> : null}
      {dirty ? <p className="mb-4 text-sm font-medium text-warn" role="status">{t.unsaved}</p> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <fieldset disabled={!editable} className="min-w-0">
          <Tabs<TabKey> value={tab} onChange={setTab} tabs={[{ value: 'design', label: t.tabs.design }, { value: 'rewards', label: t.tabs.rewards }, { value: 'rules', label: t.tabs.rules }, { value: 'share', label: t.tabs.share }]}>
            <TabPanel value="design">
              <Card>
                <CardBody className="flex flex-col gap-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label={t.cardTitle} error={save.fields.cardTitle}>
                      <Input value={draft.cardTitle} onChange={(e) => set('cardTitle', e.currentTarget.value)} maxLength={40} />
                    </Field>
                    <Field label={t.name} error={save.fields.name}>
                      <Input value={draft.name} onChange={(e) => set('name', e.currentTarget.value)} maxLength={60} />
                    </Field>
                  </div>
                  <Field label={t.description} optional hint={t.descriptionHint} error={save.fields.description}>
                    <Textarea value={draft.description} onChange={(e) => set('description', e.currentTarget.value)} maxLength={300} rows={2} />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <ColorField label={t.background} value={draft.design.backgroundColor} onChange={(v) => setDesign('backgroundColor', v)} />
                    <ColorField label={t.text} value={draft.design.textColor} onChange={(v) => setDesign('textColor', v)} />
                    <ColorField label={t.accent} value={draft.design.accentColor} onChange={(v) => setDesign('accentColor', v)} />
                  </div>
                  {contrastRatio(draft.design.backgroundColor, draft.design.textColor) < 4.5 ? <Alert tone="warn">{t.lowContrast}</Alert> : contrastRatio(draft.design.backgroundColor, draft.design.accentColor) < 1.8 ? <Alert tone="warn">{t.lowAccent}</Alert> : null}
                  <IconPicker value={draft.stampIcon} onChange={(v) => set('stampIcon', v)} />
                  <StampCountField value={draft.stampsRequired} onChange={(v) => set('stampsRequired', v)} error={save.fields.stampsRequired} />
                  <Switch checked={draft.design.showLogo} onCheckedChange={(v) => setDesign('showLogo', v)} label={t.showLogo} description={t.showLogoHint} />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label={t.rewardText} optional hint={t.rewardTextHint}>
                      <Input value={draft.design.rewardText} onChange={(e) => setDesign('rewardText', e.currentTarget.value)} maxLength={80} />
                    </Field>
                    <Field label={t.footerText} optional>
                      <Input value={draft.design.footerText} onChange={(e) => setDesign('footerText', e.currentTarget.value)} maxLength={120} />
                    </Field>
                  </div>
                </CardBody>
              </Card>
            </TabPanel>

            <TabPanel value="rewards">
              <Card>
                <CardHeader title={t.rewardsTitle} description={t.rewardsText} action={editable ? <Button variant="outline" size="sm" onClick={() => setRewardDialog({ open: true, reward: null })}><Plus className="size-4" aria-hidden /> {t.addReward}</Button> : undefined} />
                <CardBody>
                  {activeRewards.length === 0 ? (
                    <Alert tone="warn">{t.noRewards}</Alert>
                  ) : (
                    <ul className="divide-y divide-line">
                      {activeRewards.map((reward) => (
                        <li key={reward.id} className="flex items-center gap-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{reward.name}</p>
                            <p className="text-sm text-muted">{reward.cost} {unit}{reward.description ? ` · ${reward.description}` : ''}</p>
                          </div>
                          {editable ? (
                            <>
                              <button type="button" className="rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink" aria-label={`${reward.name} bearbeiten`} onClick={() => setRewardDialog({ open: true, reward })}><Pencil className="size-4" /></button>
                              <button type="button" className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`${reward.name} entfernen`} onClick={() => setRemoveReward(reward)}><Trash2 className="size-4" /></button>
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </TabPanel>

            <TabPanel value="rules">
              <Card>
                <CardBody className="flex flex-col gap-6">
                  <fieldset>
                    <legend className="text-sm font-medium">{t.policy}</legend>
                    <p className="mb-3 mt-1 text-sm text-muted">{t.policyNote}</p>
                    <div className="flex flex-col gap-2" role="radiogroup">
                      {(Object.keys(policyLabel) as BookingPolicy[]).map((policy) => {
                        const locked = policy === 'POS_EVENT' && !posAvailable && draft.bookingPolicy !== 'POS_EVENT';
                        return (
                          <button
                            key={policy}
                            type="button"
                            role="radio"
                            aria-checked={draft.bookingPolicy === policy}
                            disabled={locked}
                            onClick={() => set('bookingPolicy', policy)}
                            className={cn('rounded-xl border p-4 text-left transition-colors', draft.bookingPolicy === policy ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong', locked && 'cursor-not-allowed opacity-60')}
                          >
                            <span className="text-sm font-medium">{policyLabel[policy].label}</span>
                            <span className="mt-0.5 block text-sm text-muted">{policyLabel[policy].hint}</span>
                            {locked ? <span className="mt-1 block text-xs font-medium text-warn">{t.posNeedsPlan}</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label={t.minInterval} hint={t.minIntervalHint} error={save.fields.minIntervalMinutes}>
                      <Input type="number" inputMode="numeric" min={0} max={10080} value={draft.minIntervalMinutes} onChange={number('minIntervalMinutes', 0, 10080)} className="max-w-28" />
                    </Field>
                    <Field label={t.maxPerDay} error={save.fields.maxStampsPerDay}>
                      <Input type="number" inputMode="numeric" min={1} max={100} value={draft.maxStampsPerDay} onChange={number('maxStampsPerDay', 1, 100)} className="max-w-28" />
                    </Field>
                    <Field label={t.perTap} error={save.fields.stampsPerTap}>
                      <Input type="number" inputMode="numeric" min={1} max={100} value={draft.stampsPerTap} onChange={number('stampsPerTap', 1, 100)} className="max-w-28" />
                    </Field>
                    <Field label={t.signupBonus} error={save.fields.signupBonus}>
                      <Input type="number" inputMode="numeric" min={0} max={100} value={draft.signupBonus} onChange={number('signupBonus', 0, 100)} className="max-w-28" />
                    </Field>
                    <Field label={t.validFrom} optional error={save.fields.validFrom}>
                      <Input type="date" value={draft.validFrom} onChange={(e) => set('validFrom', e.currentTarget.value)} />
                    </Field>
                    <Field label={t.validUntil} optional error={save.fields.validUntil}>
                      <Input type="date" value={draft.validUntil} onChange={(e) => set('validUntil', e.currentTarget.value)} />
                    </Field>
                    <Field label={t.cardValidity} optional hint={t.cardValidityHint} error={save.fields.cardValidityDays}>
                      <Input type="number" inputMode="numeric" min={30} max={3650} value={draft.cardValidityDays} onChange={(e) => set('cardValidityDays', e.currentTarget.value)} className="max-w-28" />
                    </Field>
                  </div>
                  <Field label={t.terms} optional error={save.fields.terms}>
                    <Textarea value={draft.terms} onChange={(e) => set('terms', e.currentTarget.value)} maxLength={2000} rows={4} />
                  </Field>
                </CardBody>
              </Card>
            </TabPanel>

            <TabPanel value="share">
              <Card>
                <CardHeader title={t.shareTitle} description={t.shareText} />
                <CardBody className="flex flex-col gap-5">
                  {program.status !== 'PUBLISHED' ? <Alert tone="warn">{t.notPublished}</Alert> : null}
                  <div className="flex flex-col items-start gap-5 sm:flex-row">
                    <QrImage value={program.signupUrl} alt="QR-Code zur Anmeldeseite" />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <code className="block break-all rounded-lg bg-sunken p-3 text-sm">{program.signupUrl}</code>
                      <div className="flex flex-wrap gap-2">
                        <CopyButton value={program.signupUrl} label="Link kopieren" />
                        <a href={program.signupUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-sunken"><ExternalLink className="size-3.5" aria-hidden /> {t.open}</a>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const QRCode = (await import('qrcode')).default;
                            const url = await QRCode.toDataURL(program.signupUrl, { margin: 2, width: 1024 });
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `anmeldung-${program.slug}.png`;
                            a.click();
                          }}
                        >
                          {t.downloadQr}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </TabPanel>
          </Tabs>
        </fieldset>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <CardPreviews model={{ organizationName: program.preview.organization.name, cardTitle: draft.cardTitle, stampsRequired: draft.stampsRequired, stampIcon: draft.stampIcon, rewardName: activeRewards[0]?.name ?? '', design: draft.design, logoUrl: me.organization?.logoAssetId ? `/api/public/assets/${me.organization.logoAssetId}` : null }} />
        </div>
      </div>

      <RewardDialog key={rewardDialog.reward?.id ?? 'new'} programId={id} reward={rewardDialog.reward} open={rewardDialog.open} onOpenChange={(open) => setRewardDialog((s) => ({ ...s, open }))} onSaved={() => void mutate()} unit={unit} />
      <ConfirmDialog
        open={Boolean(removeReward)}
        onOpenChange={(o) => !o && setRemoveReward(null)}
        title={t.deleteReward}
        description={removeReward?.name}
        confirmLabel="Entfernen"
        danger
        onConfirm={async () => {
          if (!removeReward) return;
          try {
            await api(`/programs/${id}/rewards/${removeReward.id}`, { method: 'DELETE' });
            await mutate();
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Fehler');
          }
          setRemoveReward(null);
        }}
      />
      <ConfirmDialog open={archiveOpen} onOpenChange={setArchiveOpen} title={t.archiveTitle} description={t.archiveText} confirmLabel={t.archive} danger loading={statusLoading} onConfirm={() => setStatus('ARCHIVED')} />
    </>
  );
}
