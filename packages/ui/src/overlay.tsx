'use client';
import * as React from 'react';
import { Dialog as RDialog, DropdownMenu as RMenu, Tabs as RTabs } from 'radix-ui';
import { Check, Copy, X } from 'lucide-react';
import { cn } from './cn';
import { Button } from './button';

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md' }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-up_0.15s_ease-out]" />
        <RDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-line bg-surface shadow-raised focus:outline-none',
            size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div className="min-w-0">
              <RDialog.Title className="text-lg font-semibold text-ink">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description> : null}
            </div>
            <RDialog.Close className="-mr-2 -mt-1 rounded-lg p-2 text-muted hover:bg-sunken hover:text-ink" aria-label="Schließen">
              <X className="size-4" />
            </RDialog.Close>
          </div>
          {children ? <div className="overflow-y-auto px-6 py-5">{children}</div> : <div className="h-5" />}
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Abbrechen', danger, onConfirm, loading }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void | Promise<void>; loading?: boolean }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={() => void onConfirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export function Menu({ trigger, children, align = 'end' }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end' }) {
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align={align} sideOffset={6} className="z-50 min-w-48 rounded-xl border border-line bg-surface p-1.5 shadow-raised">
          {children}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

export function MenuItem({ children, onSelect, danger, disabled }: { children: React.ReactNode; onSelect?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <RMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-sunken [&>svg]:size-4',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {children}
    </RMenu.Item>
  );
}

export function MenuSeparator() {
  return <RMenu.Separator className="my-1.5 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <RMenu.Label className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-subtle">{children}</RMenu.Label>;
}

export function Tabs<T extends string>({ value, onChange, tabs, children }: { value: T; onChange: (v: T) => void; tabs: Array<{ value: T; label: React.ReactNode }>; children: React.ReactNode }) {
  return (
    <RTabs.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <RTabs.List className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink"
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  );
}
export const TabPanel = RTabs.Content;

export function CopyButton({ value, label = 'Kopieren', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className={cn('inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-sunken', className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* Zwischenablage nicht verfügbar */
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span aria-live="polite">{copied ? 'Kopiert' : label}</span>
    </button>
  );
}

// ── Toasts ────────────────────────────────────────────────────────────
type ToastTone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}
const ToastContext = React.createContext<(tone: ToastTone, message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list.slice(-3), { id, tone, message }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex max-w-md animate-fade-up items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-raised',
              t.tone === 'error' ? 'bg-danger text-white dark:text-sunken' : 'bg-ink text-paper',
            )}
          >
            {t.tone === 'success' ? <Check className="size-4 shrink-0" aria-hidden /> : null}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = React.useContext(ToastContext);
  return React.useMemo(() => ({ success: (m: string) => push('success', m), error: (m: string) => push('error', m), info: (m: string) => push('info', m) }), [push]);
}
