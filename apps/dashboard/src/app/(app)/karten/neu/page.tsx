'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import type { ProgramDto } from '@tapperl/types';
import { Alert, api, Badge, Button, Card, CardBody, cn, defineCopy, Field, Input, PageHeader, useCopy } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { useSubmit } from '@/lib/use-submit';
import { CardPreviews } from '@/components/programs/previews';
import { IconPicker, StampCountField } from '@/components/programs/design-fields';
import { INDUSTRY_PRESETS } from '@/components/programs/presets';

const copy = defineCopy({
  de: {
    title: 'Neue Treuekarte',
    back: 'Treuekarten',
    type: 'Kartentyp',
    name: 'Interner Name',
    nameHint: 'Nur für dich sichtbar, z. B. „Kaffeekarte Sommer“.',
    cardTitle: 'Titel auf der Karte',
    reward: 'Prämie',
    rewardHint: 'Was bekommt dein Kunde für eine volle Karte?',
    create: 'Karte anlegen',
    planned: 'geplant',
    upgrade: 'Tarif ansehen',
  },
});

const TYPES: Array<{ value: 'STAMP' | 'POINTS' | null; label: string; hint: string }> = [
  { value: 'STAMP', label: 'Stempelkarte', hint: 'Ein Stempel pro Besuch, Prämie bei voller Karte.' },
  { value: 'POINTS', label: 'Punktekarte', hint: 'Punkte sammeln und gegen verschiedene Prämien tauschen.' },
  { value: null, label: 'Cashback', hint: 'Guthaben pro Einkauf' },
  { value: null, label: 'Mitgliedskarte', hint: 'Mitgliedschaft mit Laufzeit' },
  { value: null, label: 'Rabattkarte', hint: 'Dauerhafter Rabatt' },
  { value: null, label: 'Gutschein', hint: 'Einmaliger Gutschein' },
  { value: null, label: 'VIP-Karte', hint: 'Stufen und Vorteile' },
  { value: null, label: 'Prepaid / Multipass', hint: 'Vorausbezahlte Leistungen' },
];

export default function NewProgramPage() {
  const t = useCopy(copy);
  const router = useRouter();
  const { me } = useSession();
  const preset = INDUSTRY_PRESETS[me.organization?.industry ?? 'other'] ?? INDUSTRY_PRESETS.other!;
  const [type, setType] = React.useState<'STAMP' | 'POINTS'>('STAMP');
  const [cardTitle, setCardTitle] = React.useState(preset.cardTitle);
  const [name, setName] = React.useState(preset.cardTitle);
  const [reward, setReward] = React.useState(preset.reward);
  const [stamps, setStamps] = React.useState(preset.stampsRequired);
  const [icon, setIcon] = React.useState(preset.stampIcon);

  const form = useSubmit(async () => {
    const program = await api<ProgramDto>('/programs', {
      body: { type, name, cardTitle, stampsRequired: stamps, stampIcon: icon, reward: { name: reward }, design: { backgroundColor: preset.backgroundColor, textColor: preset.textColor, accentColor: preset.accentColor } },
    });
    router.replace(`/karten/${program.id}`);
  });

  return (
    <>
      <PageHeader title={t.title} back={<Link href="/karten" className="inline-flex items-center gap-1 text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> {t.back}</Link>} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardBody>
            <form method="post" className="flex flex-col gap-6" onSubmit={(e) => (e.preventDefault(), void form.submit())} noValidate>
              {form.error ? (
                <Alert tone="danger" action={form.code === 'limit_reached' ? <Link href="/einstellungen?tab=abo" className="text-sm font-semibold underline">{t.upgrade}</Link> : undefined}>{form.error}</Alert>
              ) : null}
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t.type}</legend>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
                  {TYPES.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      role="radio"
                      aria-checked={option.value === type}
                      disabled={!option.value}
                      onClick={() => option.value && setType(option.value)}
                      className={cn('rounded-xl border p-3 text-left transition-colors', option.value === type ? 'border-brand bg-brand-soft' : 'border-line bg-surface', option.value ? 'hover:border-line-strong' : 'cursor-not-allowed opacity-60')}
                    >
                      <span className="flex items-center justify-between gap-2 text-sm font-medium">
                        {option.label}
                        {!option.value ? <Badge><Lock className="size-3" aria-hidden /> {t.planned}</Badge> : null}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.cardTitle} error={form.fields.cardTitle}>
                  <Input value={cardTitle} onChange={(e) => setCardTitle(e.currentTarget.value)} maxLength={40} required />
                </Field>
                <Field label={t.name} hint={t.nameHint} error={form.fields.name}>
                  <Input value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={60} required />
                </Field>
              </div>
              <StampCountField value={stamps} onChange={setStamps} error={form.fields.stampsRequired} />
              <Field label={t.reward} hint={t.rewardHint} error={form.fields['reward.name']}>
                <Input value={reward} onChange={(e) => setReward(e.currentTarget.value)} maxLength={60} required />
              </Field>
              <IconPicker value={icon} onChange={setIcon} />
              <Button type="submit" size="lg" loading={form.loading} className="self-start">{t.create}</Button>
            </form>
          </CardBody>
        </Card>
        <div className="lg:sticky lg:top-8 lg:self-start">
          <CardPreviews model={{ organizationName: me.organization?.name ?? '', cardTitle, stampsRequired: stamps, stampIcon: icon, rewardName: reward, design: { backgroundColor: preset.backgroundColor, textColor: preset.textColor, accentColor: preset.accentColor, logoAssetId: null, showLogo: true, rewardText: '', footerText: '' }, logoUrl: me.organization?.logoAssetId ? `/api/public/assets/${me.organization.logoAssetId}` : null }} />
        </div>
      </div>
    </>
  );
}
