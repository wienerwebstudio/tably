import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { cn } from './cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 sm:px-6', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 sm:p-6', className)} {...props} />;
}

type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info' | 'honey';
const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  brand: 'bg-brand-soft text-brand',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  honey: 'bg-honey-soft text-honey',
};

export function Badge({ tone = 'neutral', className, children, dot }: { tone?: Tone; className?: string; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const alertIcons = { info: Info, success: CheckCircle2, warn: AlertTriangle, danger: XCircle } as const;

export function Alert({ tone = 'info', title, children, action, className }: { tone?: keyof typeof alertIcons; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const Icon = alertIcons[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-xl border p-4 text-sm', tones[tone], 'border-current/15', className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ink">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn('text-muted', title && 'mt-0.5')}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--sunken)_25%,var(--line)_50%,var(--sunken)_75%)] bg-[length:200%_100%]', className)} />;
}

export function Spinner({ className, label = 'Lädt …' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn('size-5 animate-spin text-muted', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon ? <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-sunken text-muted [&>svg]:size-6">{icon}</div> : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'Das hat nicht geklappt', description, onRetry, retryLabel = 'Erneut versuchen' }: { title?: string; description?: React.ReactNode; onRetry?: () => void; retryLabel?: string }) {
  return (
    <EmptyState
      icon={<AlertTriangle />}
      title={title}
      description={description ?? 'Bitte versuche es in einem Moment noch einmal.'}
      action={
        onRetry ? (
          <button type="button" onClick={onRetry} className="rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium hover:bg-sunken">
            {retryLabel}
          </button>
        ) : undefined
      }
    />
  );
}

export function PageHeader({ title, description, actions, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? <div className="mb-2 text-sm">{back}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Kennzahl mit optionalem Vergleich zum Vorzeitraum. */
export function Stat({ label, value, previous, hint, format = (n) => n.toLocaleString('de-DE') }: { label: string; value: number | string; previous?: number | null; hint?: React.ReactNode; format?: (n: number) => string }) {
  let delta: React.ReactNode = null;
  if (typeof value === 'number' && typeof previous === 'number') {
    if (previous === 0 && value === 0) delta = <span className="text-subtle">unverändert</span>;
    else if (previous === 0) delta = <span className="text-success">neu</span>;
    else {
      const pct = Math.round(((value - previous) / previous) * 100);
      delta = <span className={pct > 0 ? 'text-success' : pct < 0 ? 'text-danger' : 'text-subtle'}>{pct > 0 ? '+' : ''}{pct} %</span>;
    }
  }
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink tabular">{typeof value === 'number' ? format(value) : value}</p>
      {delta || hint ? (
        <p className="mt-1.5 text-xs text-muted">
          {delta}
          {delta && typeof previous === 'number' ? <span> ggü. Vorzeitraum ({format(previous)})</span> : null}
          {!delta && hint ? hint : null}
        </p>
      ) : null}
    </Card>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-left text-sm', className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('whitespace-nowrap border-b border-line px-4 py-3 text-xs font-medium uppercase tracking-wide text-subtle first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6', className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-line px-4 py-3 align-middle text-ink first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6', className)} {...props} />;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const btn = 'rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium hover:bg-sunken disabled:opacity-40 disabled:hover:bg-surface';
  return (
    <nav aria-label="Seiten" className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
      <p className="text-sm text-muted tabular">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} von {total.toLocaleString('de-DE')}
      </p>
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Zurück
        </button>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Weiter
        </button>
      </div>
    </nav>
  );
}

export function DefinitionList({ items, className }: { items: Array<{ label: React.ReactNode; value: React.ReactNode }>; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line text-sm', className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-muted">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
