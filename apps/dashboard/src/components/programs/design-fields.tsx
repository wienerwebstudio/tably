'use client';
import * as React from 'react';
import { STAMP_ICONS } from '@tably/types';
import { cn, Field, Input, StampIcon } from '@tably/ui';
import { STAMP_ICON_LABELS } from './presets';

export function ColorField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: React.ReactNode }) {
  const [text, setText] = React.useState(value);
  React.useEffect(() => setText(value), [value]);
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} auswählen`} value={value} onChange={(e) => onChange(e.currentTarget.value.toUpperCase())} className="size-10 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1" />
        <Input
          id={id}
          value={text}
          onChange={(e) => {
            const v = e.currentTarget.value.trim();
            setText(v);
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toUpperCase());
          }}
          onBlur={() => setText(value)}
          maxLength={7}
          spellCheck={false}
          className="font-mono uppercase"
        />
      </div>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Stempelsymbol</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12 lg:grid-cols-6 xl:grid-cols-12" role="radiogroup">
        {STAMP_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={value === icon}
            aria-label={STAMP_ICON_LABELS[icon] ?? icon}
            title={STAMP_ICON_LABELS[icon] ?? icon}
            onClick={() => onChange(icon)}
            className={cn('flex aspect-square items-center justify-center rounded-xl border transition-colors', value === icon ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink')}
          >
            <StampIcon name={icon} className="size-5" />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function StampCountField({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  return (
    <Field label="Stempel bis zur Prämie" error={error} hint="Üblich sind 6 bis 12. Weniger Stempel motivieren schneller.">
      <Input type="number" inputMode="numeric" min={2} max={30} value={value} onChange={(e) => onChange(Math.max(2, Math.min(30, Number(e.currentTarget.value) || 2)))} className="max-w-28" />
    </Field>
  );
}
