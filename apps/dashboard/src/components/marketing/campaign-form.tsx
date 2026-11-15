'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Cake, CreditCard, Gift, Mail, Megaphone, Sparkles, Undo2, Users, Wallet } from 'lucide-react';
import type { CampaignDetailDto, CampaignDto, CampaignType, ProgramDto, WalletStatusDto } from '@tapperl/types';
import { Alert, api, Button, Card, CardBody, CardHeader, Checkbox, cn, defineCopy, Field, Input, Segmented, Select, Spinner, Textarea, useCopy } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { campaignType, channelLabel } from '@/lib/labels';
import { CHANNELS_BY_TYPE, channelHint, isRunningType, walletConfigured, WEEKDAYS, type Channel } from './labels';

const copy = defineCopy({
  de: {
    typeTitle: 'Was möchtest du tun?',
    typeLocked: 'Der Typ lässt sich nach dem Anlegen nicht mehr ändern.',
    notInPlan: 'Nicht in deinem Tarif',
    automationUpsell: 'Geburtstagsgrüße und Rückgewinnung sind in deinem Tarif nicht enthalten.',
    planLink: 'Tarife ansehen',
    oneTime: 'Einmalig',
    running: 'Läuft automatisch',
    baseTitle: 'Name',
    name: 'Name der Kampagne',
    nameHint: 'Nur für dich sichtbar, z. B. „Sommerangebot Juli“.',
    nameRequired: 'Bitte gib der Kampagne einen Namen.',
    channelsTitle: 'Kanäle',
    channelsText: 'Wie sollen deine Kunden davon erfahren?',
    channelsRequired: 'Bitte wähle mindestens einen Kanal.',
    emailNotInPlan: 'E-Mail-Kampagnen sind in deinem Tarif nicht enthalten.',
    walletNotConfigured: 'Apple Wallet und Google Wallet sind auf diesem System nicht eingerichtet. Dieser Kanal steht deshalb nicht zur Verfügung.',
    walletStillSelected: 'Dieser Kanal ist ausgewählt, aber nicht eingerichtet – Empfänger werden übersprungen.',
    bonusChannel: 'Die Aktion wird auf der Webkarte deiner Kunden angezeigt. Es wird keine Nachricht verschickt.',
    noChannelAvailable: 'Für diesen Kampagnentyp steht dir im Moment kein Kanal zur Verfügung.',
    messageTitle: 'Nachricht',
    subject: 'Betreff',
    subjectCard: 'Titel auf der Karte',
    subjectHint: 'Erscheint als Betreff der E-Mail bzw. als Überschrift auf der Karte.',
    subjectRequired: 'Bitte gib einen Betreff bzw. Titel an.',
    body: 'Text',
    bodyHint: 'Tipp: {{vorname}} wird automatisch durch den Vornamen ersetzt – aus „Hallo {{vorname}}“ wird z. B. „Hallo Anna“.',
    bodyPlaceholder: 'Hallo {{vorname}}, …',
    insertName: 'Vornamen einfügen',
    emailFooter: 'An E-Mails hängt Tapperl automatisch einen Hinweis mit Abmeldemöglichkeit an.',
    audienceTitle: 'Zielgruppe',
    audienceTextOnce: 'Ohne Einschränkung geht die Kampagne an alle aktiven Kunden.',
    audienceTextAuto: 'Die Nachricht geht automatisch an jeden Kunden, sobald der Anlass eintritt. Hier kannst du den Kreis zusätzlich einschränken.',
    audienceTextBonus: 'Für welches Treueprogramm gilt die Aktion?',
    program: 'Treueprogramm',
    allPrograms: 'Alle Programme',
    inactiveDays: 'Nicht mehr da gewesen seit (Tagen)',
    inactiveHint: 'Nur Kunden ohne Besuch seit mindestens so vielen Tagen.',
    activeDays: 'Aktiv in den letzten (Tagen)',
    activeHint: 'Nur Kunden mit Besuch in diesem Zeitraum.',
    minBalance: 'Mindeststand (Stempel)',
    minBalanceHint: 'Nur Kunden mit mindestens so vielen Stempeln.',
    rewardReady: 'Nur Kunden, die gerade eine Prämie einlösen können',
    anyPlaceholder: 'egal',
    conflict: 'Diese beiden Bedingungen schließen sich aus – so erreichst du niemanden.',
    numberInvalid: (min: number, max: number) => `Bitte eine ganze Zahl von ${min} bis ${max}.`,
    reachTitle: 'Reichweite',
    reachTotal: 'Kunden in der Zielgruppe',
    reachEmail: 'per E-Mail erreichbar',
    reachWallet: 'per Wallet erreichbar',
    reachError: 'Die Reichweite konnte nicht berechnet werden.',
    reachConsent: 'Per E-Mail erreichst du nur Kunden mit E-Mail-Adresse, die Neuigkeiten per E-Mail zugestimmt haben. Per Wallet nur Kunden, die ihre Karte in Apple oder Google Wallet gespeichert und Mitteilungen dort zugestimmt haben. Alle anderen werden automatisch übersprungen.',
    reachAuto: 'Stand heute. Die Nachricht geht an einzelne Kunden, wenn ihr Anlass eintritt – nicht an alle auf einmal.',
    reachWalletOff: 'Wallet ist auf diesem System nicht eingerichtet – über diesen Kanal wird nichts zugestellt.',
    settingsTitle: 'Einstellungen',
    bonusStamps: 'Geschenkte Stempel',
    bonusStampsBirthdayHint: 'So viele Stempel bekommt das Geburtstagskind geschenkt. 0 = nur ein Gruß.',
    bonusStampsInactivityHint: 'So viele Stempel gibt es als Anreiz zum Wiederkommen. 0 = nur eine Erinnerung.',
    inactivityDays: 'Erinnern nach (Tagen ohne Besuch)',
    inactivityDaysHint: 'Jeder Kunde bekommt pro Pause höchstens eine Erinnerung.',
    birthdayNote: 'Geht nur an Kunden, die ihr Geburtsdatum angegeben haben. Geprüft wird einmal pro Stunde.',
    multiplier: 'Stempel zählen',
    multiplierOption: (n: number) => (n === 1 ? 'einfach (kein Bonus)' : n === 2 ? 'doppelt (×2)' : n === 3 ? 'dreifach (×3)' : `${n}-fach (×${n})`),
    weekdays: 'An diesen Wochentagen',
    weekdaysHint: 'Nichts ausgewählt = an jedem Tag.',
    startsAt: 'Beginn',
    startsAtHint: 'Leer = ab dem Start der Kampagne.',
    endsAt: 'Ende',
    endsAtHint: 'Leer = bis du die Aktion beendest.',
    endsBeforeStart: 'Das Ende liegt vor dem Beginn.',
    scheduleTitle: 'Zeitplanung',
    scheduleMode: 'Versandzeitpunkt',
    sendNow: 'Sofort beim Starten',
    sendLater: 'Zu einem Termin',
    scheduledAt: 'Versand am',
    scheduledAtRequired: 'Bitte wähle einen Termin in der Zukunft.',
    scheduleNowHint: 'Der Versand beginnt, sobald du die Kampagne auf der nächsten Seite startest.',
    scheduleLaterHint: 'Du startest die Kampagne auf der nächsten Seite – versendet wird dann automatisch zum Termin.',
    visibleUntil: 'Sichtbar bis',
    visibleUntilHint: 'Bis dahin steht der Hinweis auf der Karte. Leer = bis du die Kampagne beendest.',
    draftNote: 'Beim Speichern wird noch nichts versendet. Du prüfst alles auf der nächsten Seite und startest dann.',
    saveDraft: 'Als Entwurf speichern',
    saveChanges: 'Änderungen speichern',
    cancel: 'Abbrechen',
    limitTitle: 'Limit deines Tarifs erreicht',
    featureTitle: 'Nicht in deinem Tarif enthalten',
    fixErrors: 'Bitte prüfe die markierten Felder.',
  },
});

const TYPE_ICON: Record<CampaignType, React.ComponentType<{ className?: string }>> = { ANNOUNCEMENT: Megaphone, OFFER: Gift, BIRTHDAY: Cake, INACTIVITY: Undo2, BONUS_STAMPS: Sparkles };
const CHANNEL_ICON: Record<Channel, React.ComponentType<{ className?: string }>> = { EMAIL: Mail, WALLET: Wallet, CARD: CreditCard };
const TYPES: CampaignType[] = ['ANNOUNCEMENT', 'OFFER', 'BONUS_STAMPS', 'BIRTHDAY', 'INACTIVITY'];

interface Audience {
  total: number;
  emailReachable: number;
  walletReachable: number;
}

/** ISO-Zeit → Wert für <input type="datetime-local"> in Ortszeit */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
/** Leerer Text → null; sonst ganze Zahl im Bereich oder 'invalid'. */
function parseOptionalInt(value: string, min: number, max: number): number | null | 'invalid' {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : 'invalid';
}

function Reach({ segment, valid, type, channels, walletOn, t }: { segment: CampaignDto['segment']; valid: boolean; type: CampaignType; channels: Channel[]; walletOn: boolean; t: (typeof copy)['de'] }) {
  const [audience, setAudience] = React.useState<Audience | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const key = JSON.stringify(segment);

  React.useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api<Audience>('/campaigns/audience', { body: JSON.parse(key), signal: controller.signal })
        .then((result) => {
          setAudience(result);
          setFailed(false);
          setLoading(false);
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return;
          setFailed(true);
          setLoading(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, valid]);

  const cell = (icon: React.ReactNode, value: number | undefined, label: string, dim?: boolean) => (
    <div className={cn('rounded-xl bg-sunken px-4 py-3', dim && 'opacity-60')}>
      <p className="flex items-center gap-2 text-2xl font-semibold text-ink tabular">
        <span className="text-muted [&>svg]:size-4" aria-hidden>
          {icon}
        </span>
        {value === undefined ? '–' : value.toLocaleString('de-DE')}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );

  return (
    <div className="rounded-xl border border-line p-4" aria-live="polite" aria-busy={loading}>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        {t.reachTitle}
        {loading ? <Spinner className="size-4" label={t.reachTitle} /> : null}
      </p>
      {failed ? (
        <p className="text-sm text-danger">{t.reachError}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {cell(<Users />, audience?.total, t.reachTotal)}
          {cell(<Mail />, audience?.emailReachable, t.reachEmail, !channels.includes('EMAIL'))}
          {cell(<Wallet />, audience?.walletReachable, t.reachWallet, !channels.includes('WALLET'))}
        </div>
      )}
      {isRunningType(type) ? <p className="mt-3 text-sm text-muted">{t.reachAuto}</p> : null}
      {!walletOn && channels.includes('WALLET') ? <p className="mt-3 text-sm text-warn">{t.reachWalletOff}</p> : null}
      <p className="mt-3 text-xs text-muted">{t.reachConsent}</p>
    </div>
  );
}

export function CampaignForm({ initial, onSaved, onCancel }: { initial?: CampaignDto; onSaved: (campaign: CampaignDetailDto) => void; onCancel?: () => void }) {
  const t = useCopy(copy);
  const { me } = useSession();
  const features = me.subscription?.features;
  const emailFeature = Boolean(features?.emailCampaigns);
  const automationFeature = Boolean(features?.automations);
  const programs = useSWR<ProgramDto[]>('/programs');
  const wallet = useSWR<WalletStatusDto>('/wallet/status');
  // Solange der Status lädt, wird Wallet nicht als verfügbar dargestellt.
  const walletOn = walletConfigured(wallet.data);
  const editing = Boolean(initial);

  const [type, setType] = React.useState<CampaignType>(initial?.type ?? 'ANNOUNCEMENT');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [channels, setChannels] = React.useState<Channel[]>(initial?.channels ?? ['CARD']);
  const [subject, setSubject] = React.useState(initial?.subject ?? '');
  const [body, setBody] = React.useState(initial?.body ?? '');
  const [programId, setProgramId] = React.useState(initial?.segment.programId ?? initial?.programId ?? '');
  const [inactiveDays, setInactiveDays] = React.useState(initial?.segment.inactiveDays ? String(initial.segment.inactiveDays) : '');
  const [activeDays, setActiveDays] = React.useState(initial?.segment.activeDays ? String(initial.segment.activeDays) : '');
  const [minBalance, setMinBalance] = React.useState(initial?.segment.minBalance ? String(initial.segment.minBalance) : '');
  const [rewardReady, setRewardReady] = React.useState(initial?.segment.rewardReady ?? false);
  const [bonusStamps, setBonusStamps] = React.useState(String(initial?.config.bonusStamps ?? 1));
  const [inactivityDays, setInactivityDays] = React.useState(String(initial?.config.inactivityDays ?? 45));
  const [multiplier, setMultiplier] = React.useState(String(initial?.config.multiplier ?? 2));
  const [weekdays, setWeekdays] = React.useState<number[]>(initial?.config.weekdays ?? []);
  const [mode, setMode] = React.useState<'now' | 'later'>(initial?.scheduledAt && new Date(initial.scheduledAt).getTime() > Date.now() ? 'later' : 'now');
  const [scheduledAt, setScheduledAt] = React.useState(mode === 'later' ? toLocalInput(initial?.scheduledAt) : '');
  const [startsAt, setStartsAt] = React.useState(initial?.type === 'BONUS_STAMPS' ? toLocalInput(initial.startsAt) : '');
  const [endsAt, setEndsAt] = React.useState(toLocalInput(initial?.endsAt));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const form = useSubmit((payload: unknown) => (initial ? api<CampaignDetailDto>(`/campaigns/${initial.id}`, { method: 'PUT', body: payload }) : api<CampaignDetailDto>('/campaigns', { body: payload })));

  const channelAvailable = React.useCallback((c: Channel) => (c === 'EMAIL' ? emailFeature : c === 'WALLET' ? walletOn : true), [emailFeature, walletOn]);
  const allowedChannels = CHANNELS_BY_TYPE[type];
  const typeAvailable = (ty: CampaignType) => (ty === 'BIRTHDAY' || ty === 'INACTIVITY' ? automationFeature : true);

  function chooseType(next: CampaignType) {
    if (editing || !typeAvailable(next)) return;
    setType(next);
    const allowed = CHANNELS_BY_TYPE[next];
    const kept = channels.filter((c) => allowed.includes(c));
    const fallback = allowed.filter(channelAvailable).slice(0, 1);
    setChannels(next === 'BONUS_STAMPS' ? ['CARD'] : kept.length > 0 ? kept : fallback);
    setErrors({});
  }
  function toggleChannel(c: Channel) {
    setChannels((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));
  }
  function insertName() {
    const el = bodyRef.current;
    const token = '{{vorname}}';
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const oneTime = !isRunningType(type);
  const showSegmentFilters = oneTime;
  const showSegmentExtras = type !== 'BONUS_STAMPS';
  const parsed = {
    inactiveDays: showSegmentFilters ? parseOptionalInt(inactiveDays, 1, 730) : null,
    activeDays: showSegmentFilters ? parseOptionalInt(activeDays, 1, 730) : null,
    minBalance: showSegmentExtras ? parseOptionalInt(minBalance, 0, 100_000) : null,
  };
  const segmentValid = parsed.inactiveDays !== 'invalid' && parsed.activeDays !== 'invalid' && parsed.minBalance !== 'invalid';
  const segment: CampaignDto['segment'] = {
    programId: programId || null,
    inactiveDays: parsed.inactiveDays === 'invalid' ? null : parsed.inactiveDays,
    activeDays: parsed.activeDays === 'invalid' ? null : parsed.activeDays,
    minBalance: parsed.minBalance === 'invalid' || parsed.minBalance === 0 ? null : parsed.minBalance,
    rewardReady: showSegmentExtras ? rewardReady : false,
  };
  const conflict = segment.inactiveDays !== null && segment.activeDays !== null && segment.activeDays <= segment.inactiveDays;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t.nameRequired;
    if (channels.length === 0) next.channels = t.channelsRequired;
    if (!subject.trim()) next.subject = t.subjectRequired;
    if (parsed.inactiveDays === 'invalid') next.inactiveDays = t.numberInvalid(1, 730);
    if (parsed.activeDays === 'invalid') next.activeDays = t.numberInvalid(1, 730);
    if (parsed.minBalance === 'invalid') next.minBalance = t.numberInvalid(0, 100_000);
    const bonus = parseOptionalInt(bonusStamps, 0, 50);
    const inact = parseOptionalInt(inactivityDays, 7, 365);
    if ((type === 'BIRTHDAY' || type === 'INACTIVITY') && (bonus === 'invalid' || bonus === null)) next.bonusStamps = t.numberInvalid(0, 50);
    if (type === 'INACTIVITY' && (inact === 'invalid' || inact === null)) next.inactivityDays = t.numberInvalid(7, 365);
    const scheduledIso = oneTime && mode === 'later' ? fromLocalInput(scheduledAt) : null;
    if (oneTime && mode === 'later' && (!scheduledIso || new Date(scheduledIso).getTime() <= Date.now())) next.scheduledAt = t.scheduledAtRequired;
    const startsIso = type === 'BONUS_STAMPS' ? fromLocalInput(startsAt) : null;
    const endsIso = type === 'BONUS_STAMPS' || (oneTime && channels.includes('CARD')) ? fromLocalInput(endsAt) : null;
    const reference = startsIso ?? scheduledIso;
    if (endsIso && reference && endsIso <= reference) next.endsAt = t.endsBeforeStart;
    setErrors(next);
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const saved = await form.submit({
      name: name.trim(),
      type,
      programId: programId || null,
      channels,
      subject: subject.trim(),
      body: body.trim(),
      segment,
      config: {
        inactivityDays: typeof inact === 'number' ? inact : 45,
        bonusStamps: (type === 'BIRTHDAY' || type === 'INACTIVITY') && typeof bonus === 'number' ? bonus : 0,
        multiplier: Number(multiplier) || 2,
        weekdays: type === 'BONUS_STAMPS' ? [...weekdays].sort((a, b) => a - b) : [],
      },
      scheduledAt: scheduledIso,
      startsAt: startsIso,
      endsAt: endsIso,
    });
    if (saved) onSaved(saved);
  }

  const err = (field: string) => errors[field] ?? form.fields[field] ?? null;
  const programOptions = (programs.data ?? []).filter((p) => p.status !== 'ARCHIVED' || p.id === programId);
  const noChannel = allowedChannels.every((c) => !channelAvailable(c) && !channels.includes(c));
  const planError = form.code === 'limit_reached' || form.code === 'feature_not_in_plan';

  return (
    <form method="post" onSubmit={onSubmit} onChange={() => (Object.keys(errors).length > 0 ? setErrors({}) : undefined)} noValidate className="flex flex-col gap-6">
      {/* Typ */}
      <Card>
        <CardHeader title={t.typeTitle} description={editing ? t.typeLocked : undefined} />
        <CardBody>
          <div role="radiogroup" aria-label={t.typeTitle} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {TYPES.map((ty) => {
              const Icon = TYPE_ICON[ty];
              const available = typeAvailable(ty);
              const selected = type === ty;
              const disabled = !available || (editing && !selected);
              return (
                <button
                  key={ty}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={disabled || undefined}
                  onClick={() => chooseType(ty)}
                  className={cn('flex gap-3 rounded-xl border p-4 text-left transition-colors', selected ? 'border-brand bg-brand-soft' : 'border-line-strong', disabled ? 'cursor-not-allowed opacity-55' : !selected && 'hover:bg-sunken')}
                >
                  <Icon className={cn('mt-0.5 size-5 shrink-0', selected ? 'text-brand' : 'text-muted')} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{campaignType[ty].label}</span>
                    <span className="mt-0.5 block text-sm text-muted">{campaignType[ty].hint}</span>
                    <span className="mt-2 block text-xs font-medium text-subtle">{!available ? t.notInPlan : isRunningType(ty) ? t.running : t.oneTime}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {!automationFeature && !editing ? (
            <p className="mt-3 text-sm text-muted">
              {t.automationUpsell}{' '}
              <Link href="/einstellungen?tab=abo" className="font-medium text-brand hover:underline">
                {t.planLink}
              </Link>
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* Name + Kanäle */}
      <Card>
        <CardHeader title={t.channelsTitle} description={type === 'BONUS_STAMPS' ? t.bonusChannel : t.channelsText} />
        <CardBody className="flex flex-col gap-5">
          <Field label={t.name} hint={t.nameHint} error={err('name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" />
          </Field>
          {type !== 'BONUS_STAMPS' ? (
            <fieldset aria-describedby={err('channels') ? 'channels-error' : undefined}>
              <legend className="mb-2 text-sm font-medium text-ink">{t.channelsTitle}</legend>
              <div className="grid gap-2">
                {allowedChannels.map((c) => {
                  const Icon = CHANNEL_ICON[c];
                  const checked = channels.includes(c);
                  const available = channelAvailable(c);
                  const disabled = !available && !checked;
                  const reason = c === 'EMAIL' && !emailFeature ? t.emailNotInPlan : c === 'WALLET' && !walletOn && !wallet.isLoading ? (checked ? t.walletStillSelected : t.walletNotConfigured) : null;
                  return (
                    <label key={c} className={cn('flex gap-3 rounded-xl border p-3.5', checked ? 'border-brand bg-brand-soft' : 'border-line-strong', disabled ? 'opacity-60' : 'cursor-pointer')}>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleChannel(c)} className="mt-0.5 size-[18px] shrink-0 rounded border-line-strong accent-[var(--brand)]" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium text-ink">
                          <Icon className="size-4 text-muted" aria-hidden />
                          {channelLabel[c]}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">{channelHint[c]}</span>
                        {reason ? (
                          <span className="mt-1 block text-sm text-warn">
                            {reason}{' '}
                            {c === 'EMAIL' ? (
                              <Link href="/einstellungen?tab=abo" className="font-medium text-brand hover:underline">
                                {t.planLink}
                              </Link>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
              {err('channels') ? (
                <p id="channels-error" role="alert" className="mt-1.5 text-sm text-danger">
                  {err('channels')}
                </p>
              ) : null}
              {noChannel && !wallet.isLoading ? (
                <Alert tone="warn" className="mt-3">
                  {t.noChannelAvailable}
                </Alert>
              ) : null}
            </fieldset>
          ) : null}
        </CardBody>
      </Card>

      {/* Nachricht */}
      <Card>
        <CardHeader title={t.messageTitle} />
        <CardBody className="flex flex-col gap-5">
          <Field label={type === 'BONUS_STAMPS' ? t.subjectCard : t.subject} hint={t.subjectHint} error={err('subject')}>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />
          </Field>
          <Field label={t.body} hint={t.bodyHint} error={err('body')} optional>
            <Textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={6} placeholder={t.bodyPlaceholder} />
          </Field>
          <div className="-mt-2 flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={insertName}>
              {t.insertName}
            </Button>
            <span className="text-xs text-subtle tabular">{body.length} / 2000</span>
          </div>
          {channels.includes('EMAIL') ? <p className="text-sm text-muted">{t.emailFooter}</p> : null}
        </CardBody>
      </Card>

      {/* Zielgruppe */}
      <Card>
        <CardHeader title={t.audienceTitle} description={type === 'BONUS_STAMPS' ? t.audienceTextBonus : oneTime ? t.audienceTextOnce : t.audienceTextAuto} />
        <CardBody className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.program} error={err('programId')}>
              <Select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!programs.data}>
                <option value="">{t.allPrograms}</option>
                {programOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            {showSegmentExtras ? (
              <Field label={t.minBalance} hint={t.minBalanceHint} error={err('minBalance')} optional>
                <Input type="number" inputMode="numeric" min={0} max={100000} step={1} value={minBalance} onChange={(e) => setMinBalance(e.target.value)} placeholder={t.anyPlaceholder} />
              </Field>
            ) : null}
            {showSegmentFilters ? (
              <>
                <Field label={t.inactiveDays} hint={t.inactiveHint} error={err('inactiveDays')} optional>
                  <Input type="number" inputMode="numeric" min={1} max={730} step={1} value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} placeholder={t.anyPlaceholder} />
                </Field>
                <Field label={t.activeDays} hint={t.activeHint} error={err('activeDays')} optional>
                  <Input type="number" inputMode="numeric" min={1} max={730} step={1} value={activeDays} onChange={(e) => setActiveDays(e.target.value)} placeholder={t.anyPlaceholder} />
                </Field>
              </>
            ) : null}
          </div>
          {showSegmentExtras ? <Checkbox label={t.rewardReady} checked={rewardReady} onChange={(e) => setRewardReady(e.target.checked)} /> : null}
          {conflict ? <Alert tone="warn">{t.conflict}</Alert> : null}
          {showSegmentExtras ? <Reach segment={segment} valid={segmentValid} type={type} channels={channels} walletOn={walletOn || wallet.isLoading} t={t} /> : null}
        </CardBody>
      </Card>

      {/* Typabhängige Einstellungen */}
      {type === 'BIRTHDAY' || type === 'INACTIVITY' || type === 'BONUS_STAMPS' ? (
        <Card>
          <CardHeader title={t.settingsTitle} description={type === 'BIRTHDAY' ? t.birthdayNote : undefined} />
          <CardBody className="flex flex-col gap-5">
            {type === 'INACTIVITY' ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.inactivityDays} hint={t.inactivityDaysHint} error={err('inactivityDays')}>
                  <Input type="number" inputMode="numeric" min={7} max={365} step={1} value={inactivityDays} onChange={(e) => setInactivityDays(e.target.value)} />
                </Field>
                <Field label={t.bonusStamps} hint={t.bonusStampsInactivityHint} error={err('bonusStamps')}>
                  <Input type="number" inputMode="numeric" min={0} max={50} step={1} value={bonusStamps} onChange={(e) => setBonusStamps(e.target.value)} />
                </Field>
              </div>
            ) : null}
            {type === 'BIRTHDAY' ? (
              <Field label={t.bonusStamps} hint={t.bonusStampsBirthdayHint} error={err('bonusStamps')} className="sm:max-w-xs">
                <Input type="number" inputMode="numeric" min={0} max={50} step={1} value={bonusStamps} onChange={(e) => setBonusStamps(e.target.value)} />
              </Field>
            ) : null}
            {type === 'BONUS_STAMPS' ? (
              <>
                <Field label={t.multiplier} className="sm:max-w-xs">
                  <Select value={multiplier} onChange={(e) => setMultiplier(e.target.value)}>
                    {[2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {t.multiplierOption(n)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-ink">{t.weekdays}</legend>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => {
                      const on = weekdays.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          aria-pressed={on}
                          aria-label={d.long}
                          onClick={() => setWeekdays((list) => (on ? list.filter((x) => x !== d.value) : [...list, d.value]))}
                          className={cn('h-10 w-11 rounded-lg border text-sm font-medium transition-colors', on ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-surface text-ink hover:bg-sunken')}
                        >
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-sm text-muted">{t.weekdaysHint}</p>
                </fieldset>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t.startsAt} hint={t.startsAtHint} error={err('startsAt')} optional>
                    <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                  </Field>
                  <Field label={t.endsAt} hint={t.endsAtHint} error={err('endsAt')} optional>
                    <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  </Field>
                </div>
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {/* Zeitplanung für einmalige Kampagnen */}
      {oneTime ? (
        <Card>
          <CardHeader title={t.scheduleTitle} />
          <CardBody className="flex flex-col gap-5">
            <div>
              <Segmented<'now' | 'later'> label={t.scheduleMode} value={mode} onChange={setMode} options={[{ value: 'now', label: t.sendNow }, { value: 'later', label: t.sendLater }]} />
              <p className="mt-2 text-sm text-muted">{mode === 'now' ? t.scheduleNowHint : t.scheduleLaterHint}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {mode === 'later' ? (
                <Field label={t.scheduledAt} error={err('scheduledAt')}>
                  <Input type="datetime-local" value={scheduledAt} min={toLocalInput(new Date().toISOString())} onChange={(e) => setScheduledAt(e.target.value)} />
                </Field>
              ) : null}
              {channels.includes('CARD') ? (
                <Field label={t.visibleUntil} hint={t.visibleUntilHint} error={err('endsAt')} optional>
                  <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </Field>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {form.error ? (
        <Alert tone={planError ? 'warn' : 'danger'} title={form.code === 'limit_reached' ? t.limitTitle : form.code === 'feature_not_in_plan' ? t.featureTitle : undefined}>
          <p>{form.error}</p>
          {planError ? (
            <Link href="/einstellungen?tab=abo" className="mt-1 inline-block font-medium text-brand underline">
              {t.planLink}
            </Link>
          ) : null}
        </Alert>
      ) : Object.keys(errors).length > 0 ? (
        <Alert tone="danger">{t.fixErrors}</Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={form.loading} disabled={noChannel && channels.length === 0}>
          {editing ? t.saveChanges : t.saveDraft}
        </Button>
        {onCancel ? (
          <Button variant="outline" size="lg" onClick={onCancel}>
            {t.cancel}
          </Button>
        ) : null}
        {!editing ? <p className="text-sm text-muted sm:ml-2">{t.draftNote}</p> : null}
      </div>
    </form>
  );
}
