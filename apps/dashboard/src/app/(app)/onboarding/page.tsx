'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, ArrowRight, Check, Nfc, PartyPopper, TestTube2 } from 'lucide-react';
import { INDUSTRIES } from '@tably/config';
import type { DeviceDetailDto, DeviceDto, LocationDto, OnboardingDto, ProgramDto, SimulatedTapDto } from '@tably/types';
import { Alert, api, ApiError, Badge, Button, buttonClass, Card, cn, defineCopy, Field, Input, Logo, LoyaltyCard, Skeleton, useCopy, useToast } from '@tably/ui';
import { useSession } from '@/lib/session';
import { industryLabel } from '@/lib/labels';
import { useSubmit } from '@/lib/use-submit';
import { ColorField, IconPicker, StampCountField } from '@/components/programs/design-fields';
import { INDUSTRY_PRESETS } from '@/components/programs/presets';
import { QrImage, toCardData } from '@/components/programs/previews';

const copy = defineCopy({
  de: {
    steps: ['Betrieb', 'Karte', 'Veröffentlichen', 'Stempel', 'Test'],
    skip: 'Später fortsetzen',
    back: 'Zurück',
    next: 'Weiter',
    companyTitle: 'Erzähl uns von deinem Betrieb',
    companyText: 'Damit schlagen wir dir eine passende Karte vor.',
    companyName: 'Name des Betriebs',
    industry: 'Branche',
    city: 'Ort',
    cardTitle: 'Gestalte deine Treuekarte',
    cardText: 'Ein Vorschlag für deine Branche – ändere, was du möchtest. Feinschliff ist später jederzeit möglich.',
    title: 'Titel auf der Karte',
    reward: 'Prämie für eine volle Karte',
    background: 'Kartenfarbe',
    accent: 'Stempelfarbe',
    existing: 'Deine Karte ist bereits angelegt.',
    editCard: 'Im Designer bearbeiten',
    publishTitle: 'Karte veröffentlichen',
    publishText: 'Sobald die Karte veröffentlicht ist, können sich Kund:innen anmelden und Stempel sammeln.',
    publish: 'Jetzt veröffentlichen',
    publishedOk: 'Deine Karte ist veröffentlicht.',
    verifyFirst: 'Bitte bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen Link geschickt.',
    resend: 'Link erneut senden',
    resent: 'Wir haben dir einen neuen Link geschickt.',
    recheck: 'Ich habe bestätigt',
    deviceTitle: 'Deinen Stempel registrieren',
    deviceText: 'Der NFC-Stempel ist das Gerät, das dein Team an das Handy der Kund:innen hält.',
    physical: 'Ich habe einen Tably-Stempel',
    physicalHint: 'Der Stempel wird registriert und beim ersten Tap aktiviert.',
    simulated: 'Erst ohne Hardware ausprobieren',
    simulatedHint: 'Ein simulierter Stempel verhält sich wie ein echter – ideal zum Testen.',
    simulatedOff: 'Die Simulation ist auf diesem System nicht aktiviert.',
    deviceName: 'Name des Stempels',
    register: 'Stempel registrieren',
    deviceExists: 'Ein Stempel ist bereits registriert.',
    testTitle: 'Der erste Stempel',
    testSim: 'Erzeuge einen simulierten Tap und öffne den Link mit deinem Handy – genau das passiert, wenn dein Team den Stempel an ein Handy hält.',
    simulate: 'Tap simulieren',
    simNote: 'SIMULATION · Jeder Link ist nur einmal gültig.',
    openHere: 'Auf diesem Gerät öffnen',
    waiting: 'Warte auf den ersten Stempel …',
    testPhysical: 'Halte den Stempel an ein Smartphone. Der erste Tap aktiviert ihn, der zweite vergibt den ersten Stempel. Falls der Chip noch nicht beschrieben ist, findest du die Personalisierungsdaten beim Stempel.',
    toDevice: 'Zum Stempel',
    testDone: 'Geschafft – der erste Stempel ist vergeben!',
    finish: 'Zum Dashboard',
    finishLater: 'Test überspringen',
  },
});

const PALETTE = ['#1F3A2E', '#16181D', '#1D2A44', '#2B1D1A', '#0E3A5B', '#F6EBD9', '#FBEFF1', '#EEF4EC'];
const lightText = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 150;
};

export default function OnboardingPage() {
  const t = useCopy(copy);
  const router = useRouter();
  const toast = useToast();
  const { me, refresh } = useSession();
  const org = me.organization!;
  const onboarding = useSWR<OnboardingDto>('/organization/onboarding', { refreshInterval: (data) => (data && !data.steps.find((s) => s.key === 'test')?.done ? 3000 : 0) });
  const programs = useSWR<ProgramDto[]>('/programs');
  const devices = useSWR<DeviceDto[]>('/devices');
  const locations = useSWR<LocationDto[]>('/organization/locations');
  const status = useSWR<{ nfcSimulator: boolean }>('/public/status');
  const [step, setStep] = React.useState<number | null>(null);

  const done = React.useCallback((key: string) => Boolean(onboarding.data?.steps.find((s) => s.key === key)?.done), [onboarding.data]);
  // Beim ersten Laden beim ersten offenen Schritt einsteigen.
  React.useEffect(() => {
    if (step !== null || !onboarding.data) return;
    const order = ['company', 'program', 'publish', 'device', 'test'];
    const first = order.findIndex((key) => !done(key));
    setStep(first === -1 ? 4 : first);
  }, [onboarding.data, step, done]);

  // Schritt 1
  const [name, setName] = React.useState(org.name);
  const [industry, setIndustry] = React.useState(org.industry);
  const [city, setCity] = React.useState(org.city ?? '');
  const company = useSubmit(async () => {
    await api('/organization', { method: 'PATCH', body: { name, industry, city: city || null } });
    await refresh();
    void onboarding.mutate();
    setStep(1);
  });

  // Schritt 2
  const preset = INDUSTRY_PRESETS[industry] ?? INDUSTRY_PRESETS.other!;
  const [card, setCard] = React.useState(preset);
  const touched = React.useRef(false);
  React.useEffect(() => {
    if (!touched.current) setCard(preset);
  }, [preset]);
  const editCard = (patch: Partial<typeof card>) => ((touched.current = true), setCard((c) => ({ ...c, ...patch })));
  const program = programs.data?.[0] ?? null;
  const createCard = useSubmit(async () => {
    await api('/programs', {
      body: { name: card.cardTitle, cardTitle: card.cardTitle, stampsRequired: card.stampsRequired, stampIcon: card.stampIcon, reward: { name: card.reward }, design: { backgroundColor: card.backgroundColor, textColor: card.textColor, accentColor: card.accentColor } },
    });
    await Promise.all([programs.mutate(), onboarding.mutate()]);
    setStep(2);
  });

  // Schritt 3
  const publish = useSubmit(async () => {
    if (!program) return;
    await api(`/programs/${program.id}/status`, { method: 'PUT', body: { status: 'PUBLISHED' } });
    await Promise.all([programs.mutate(), onboarding.mutate()]);
    toast.success(t.publishedOk);
    setStep(3);
  });

  // Schritt 4
  const [kind, setKind] = React.useState<'PASSIVE_NTAG424' | 'SIMULATED'>('PASSIVE_NTAG424');
  const [deviceName, setDeviceName] = React.useState('Stempel Theke');
  const device = devices.data?.[0] ?? null;
  const register = useSubmit(async () => {
    await api<DeviceDetailDto>('/devices', { body: { name: deviceName, kind, programId: program?.id ?? null, locationId: locations.data?.find((l) => l.isActive)?.id ?? null } });
    await Promise.all([devices.mutate(), onboarding.mutate()]);
    setStep(4);
  });

  // Schritt 5
  const [sim, setSim] = React.useState<SimulatedTapDto | null>(null);
  const simulate = useSubmit(async () => {
    const target = devices.data?.find((d) => d.kind === 'SIMULATED' && d.status === 'ACTIVE');
    if (!target) return;
    setSim(await api<SimulatedTapDto>(`/devices/${target.id}/simulate-tap`, { method: 'POST' }));
  });
  const finish = async () => {
    await api('/organization/onboarding/complete', { method: 'POST' }).catch(() => undefined);
    router.replace('/');
  };

  const loading = step === null || !programs.data || !devices.data;
  const simulatedDevice = devices.data?.find((d) => d.kind === 'SIMULATED' && d.status === 'ACTIVE');
  const testDone = done('test');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <Link href="/" className="text-sm text-muted hover:text-ink">{t.skip}</Link>
      </header>

      <ol className="mt-8 flex items-center gap-2" aria-label="Fortschritt">
        {t.steps.map((label, i) => (
          <li key={label} className="flex min-w-0 flex-1 flex-col gap-2" aria-current={step === i ? 'step' : undefined}>
            <span className={cn('h-1.5 rounded-full', step !== null && i <= step ? 'bg-brand' : 'bg-line')} aria-hidden />
            <span className={cn('truncate text-xs font-medium', step === i ? 'text-ink' : 'text-subtle')}>
              <span className="sr-only">Schritt {i + 1}: </span>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <main className="flex flex-1 flex-col py-10">
        {loading ? (
          <div className="mx-auto w-full max-w-xl"><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-6 h-64" /></div>
        ) : step === 0 ? (
          <form method="post" className="mx-auto flex w-full max-w-xl flex-col gap-6" onSubmit={(e) => (e.preventDefault(), void company.submit())} noValidate>
            <div>
              <h1 className="font-display text-3xl tracking-tight">{t.companyTitle}</h1>
              <p className="mt-2 text-muted">{t.companyText}</p>
            </div>
            {company.error ? <Alert tone="danger">{company.error}</Alert> : null}
            <Field label={t.companyName} error={company.fields.name}>
              <Input value={name} onChange={(e) => setName(e.currentTarget.value)} required />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t.industry}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
                {INDUSTRIES.map((key) => (
                  <button key={key} type="button" role="radio" aria-checked={industry === key} onClick={() => setIndustry(key)} className={cn('rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors', industry === key ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface hover:border-line-strong')}>
                    {industryLabel[key]}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label={t.city} optional error={company.fields.city}>
              <Input value={city} onChange={(e) => setCity(e.currentTarget.value)} autoComplete="address-level2" />
            </Field>
            <Button type="submit" size="lg" loading={company.loading} className="self-end">{t.next} <ArrowRight className="size-4" aria-hidden /></Button>
          </form>
        ) : step === 1 ? (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
            <form method="post" className="flex flex-col gap-6" onSubmit={(e) => (e.preventDefault(), program ? setStep(2) : void createCard.submit())} noValidate>
              <div>
                <h1 className="font-display text-3xl tracking-tight">{t.cardTitle}</h1>
                <p className="mt-2 text-muted">{t.cardText}</p>
              </div>
              {createCard.error ? <Alert tone="danger">{createCard.error}</Alert> : null}
              {program ? (
                <Alert tone="success" action={<Link href={`/karten/${program.id}`} className="text-sm font-semibold underline">{t.editCard}</Link>}>{t.existing}</Alert>
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label={t.title} error={createCard.fields.cardTitle}>
                      <Input value={card.cardTitle} onChange={(e) => editCard({ cardTitle: e.currentTarget.value })} maxLength={40} required />
                    </Field>
                    <Field label={t.reward} error={createCard.fields['reward.name']}>
                      <Input value={card.reward} onChange={(e) => editCard({ reward: e.currentTarget.value })} maxLength={60} required />
                    </Field>
                  </div>
                  <StampCountField value={card.stampsRequired} onChange={(v) => editCard({ stampsRequired: v })} />
                  <IconPicker value={card.stampIcon} onChange={(v) => editCard({ stampIcon: v })} />
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium">{t.background}</legend>
                    <div className="flex flex-wrap gap-2">
                      {PALETTE.map((color) => (
                        <button key={color} type="button" aria-label={`Farbe ${color}`} aria-pressed={card.backgroundColor === color} onClick={() => editCard({ backgroundColor: color, textColor: lightText(color) ? '#FFFFFF' : '#1F2A24' })} className={cn('size-10 rounded-full border-2', card.backgroundColor === color ? 'border-brand ring-2 ring-brand/30' : 'border-line')} style={{ background: color }} />
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <ColorField label={t.background} value={card.backgroundColor} onChange={(v) => editCard({ backgroundColor: v, textColor: lightText(v) ? '#FFFFFF' : '#1F2A24' })} />
                    <ColorField label={t.accent} value={card.accentColor} onChange={(v) => editCard({ accentColor: v })} />
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="size-4" aria-hidden /> {t.back}</Button>
                <Button type="submit" size="lg" loading={createCard.loading}>{t.next} <ArrowRight className="size-4" aria-hidden /></Button>
              </div>
            </form>
            <div className="lg:sticky lg:top-8 lg:self-start">
              <LoyaltyCard
                data={
                  program
                    ? toCardData({ organizationName: org.name, cardTitle: program.cardTitle, stampsRequired: program.stampsRequired, stampIcon: program.stampIcon, rewardName: program.rewards[0]?.name ?? '', design: program.design, logoUrl: program.preview.logoUrl }, 3)
                    : { organizationName: name, cardTitle: card.cardTitle || 'Treuekarte', stampsRequired: card.stampsRequired, balance: Math.min(3, card.stampsRequired), stampIcon: card.stampIcon, rewardName: card.reward, backgroundColor: card.backgroundColor, textColor: card.textColor, accentColor: card.accentColor }
                }
              />
            </div>
          </div>
        ) : step === 2 ? (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
            <div>
              <h1 className="font-display text-3xl tracking-tight">{t.publishTitle}</h1>
              <p className="mt-2 text-muted">{t.publishText}</p>
            </div>
            {publish.error && publish.code !== 'email_not_verified' ? <Alert tone="danger">{publish.error}</Alert> : null}
            {program?.status === 'PUBLISHED' ? (
              <Alert tone="success">{t.publishedOk}</Alert>
            ) : !me.user.emailVerified ? (
              <Alert
                tone="warn"
                action={
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => api('/auth/resend-verification', { method: 'POST' }).then(() => toast.success(t.resent)).catch((err) => toast.error(err instanceof ApiError ? err.message : 'Fehler'))}>{t.resend}</Button>
                    <Button size="sm" onClick={() => void refresh()}>{t.recheck}</Button>
                  </div>
                }
              >
                {t.verifyFirst} ({me.user.email})
              </Alert>
            ) : null}
            {program ? (
              <LoyaltyCard className="mx-auto max-w-sm" data={toCardData({ organizationName: org.name, cardTitle: program.cardTitle, stampsRequired: program.stampsRequired, stampIcon: program.stampIcon, rewardName: program.rewards[0]?.name ?? '', design: program.design, logoUrl: program.preview.logoUrl }, 0)} />
            ) : null}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="size-4" aria-hidden /> {t.back}</Button>
              {program?.status === 'PUBLISHED' ? (
                <Button size="lg" onClick={() => setStep(3)}>{t.next} <ArrowRight className="size-4" aria-hidden /></Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="lg" onClick={() => setStep(3)}>Später</Button>
                  <Button variant="honey" size="lg" loading={publish.loading} disabled={!program || !me.user.emailVerified} onClick={() => void publish.submit()}>{t.publish}</Button>
                </div>
              )}
            </div>
          </div>
        ) : step === 3 ? (
          <form method="post" className="mx-auto flex w-full max-w-xl flex-col gap-6" onSubmit={(e) => (e.preventDefault(), device ? setStep(4) : void register.submit())} noValidate>
            <div>
              <h1 className="font-display text-3xl tracking-tight">{t.deviceTitle}</h1>
              <p className="mt-2 text-muted">{t.deviceText}</p>
            </div>
            {register.error ? <Alert tone="danger">{register.error}</Alert> : null}
            {device ? (
              <Alert tone="success">{t.deviceExists} ({device.name})</Alert>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Art des Stempels">
                  {(
                    [
                      { value: 'PASSIVE_NTAG424', icon: Nfc, label: t.physical, hint: t.physicalHint, disabled: false },
                      { value: 'SIMULATED', icon: TestTube2, label: t.simulated, hint: status.data?.nfcSimulator ? t.simulatedHint : t.simulatedOff, disabled: !status.data?.nfcSimulator },
                    ] as const
                  ).map((option) => (
                    <button key={option.value} type="button" role="radio" aria-checked={kind === option.value} disabled={option.disabled} onClick={() => setKind(option.value)} className={cn('rounded-2xl border p-5 text-left transition-colors', kind === option.value ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-line-strong', option.disabled && 'cursor-not-allowed opacity-60')}>
                      <option.icon className="size-6 text-brand" aria-hidden />
                      <span className="mt-3 block font-medium">{option.label}</span>
                      <span className="mt-1 block text-sm text-muted">{option.hint}</span>
                    </button>
                  ))}
                </div>
                <Field label={t.deviceName} error={register.fields.name}>
                  <Input value={deviceName} onChange={(e) => setDeviceName(e.currentTarget.value)} maxLength={60} required />
                </Field>
              </>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="size-4" aria-hidden /> {t.back}</Button>
              <Button type="submit" size="lg" loading={register.loading}>{device ? t.next : t.register} <ArrowRight className="size-4" aria-hidden /></Button>
            </div>
          </form>
        ) : (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
            <h1 className="font-display text-3xl tracking-tight">{t.testTitle}</h1>
            {testDone ? (
              <Card className="flex flex-col items-center gap-4 p-10 text-center">
                <span className="flex size-16 animate-pop items-center justify-center rounded-full bg-success text-white"><PartyPopper className="size-7" aria-hidden /></span>
                <p className="text-lg font-semibold" role="status">{t.testDone}</p>
                <Button size="lg" onClick={() => void finish()}>{t.finish}</Button>
              </Card>
            ) : (
              <>
                {program && program.status !== 'PUBLISHED' ? <Alert tone="warn">Die Karte ist noch nicht veröffentlicht – Stempel können erst danach vergeben werden.</Alert> : null}
                {simulatedDevice ? (
                  <Card className="flex flex-col gap-5 p-6">
                    <p className="text-muted">{t.testSim}</p>
                    {simulate.error ? <Alert tone="danger">{simulate.error}</Alert> : null}
                    {sim ? (
                      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                        <QrImage value={sim.url} alt="QR-Code des simulierten Taps" />
                        <div className="flex flex-col gap-3">
                          <Badge tone="warn">{t.simNote}</Badge>
                          <a href={sim.url} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'outline' })}>{t.openHere}</a>
                          <Button variant="ghost" loading={simulate.loading} onClick={() => void simulate.submit()}>Neuen Tap erzeugen</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="lg" loading={simulate.loading} onClick={() => void simulate.submit()} className="self-start">{t.simulate}</Button>
                    )}
                  </Card>
                ) : (
                  <Card className="flex flex-col gap-4 p-6">
                    <p className="text-muted">{t.testPhysical}</p>
                    {device ? <Link href={`/stempel/${device.id}`} className={buttonClass({ variant: 'outline', className: 'self-start' })}>{t.toDevice}</Link> : null}
                  </Card>
                )}
                <p className="flex items-center gap-2 text-sm text-muted" role="status"><span className="size-2 animate-pulse rounded-full bg-honey" aria-hidden /> {t.waiting}</p>
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="size-4" aria-hidden /> {t.back}</Button>
                  <Button variant="outline" onClick={() => void finish()}>{t.finishLater}</Button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
      {step !== null && step < 4 && onboarding.data ? (
        <p className="pb-2 text-center text-xs text-subtle"><Check className="mr-1 inline size-3" aria-hidden />Dein Fortschritt wird automatisch gespeichert.</p>
      ) : null}
    </div>
  );
}
