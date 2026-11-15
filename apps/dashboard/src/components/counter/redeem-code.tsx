'use client';
import * as React from 'react';
import { Gift, PartyPopper } from 'lucide-react';
import { api, ApiError, Button, Card, CardBody, CardHeader, defineCopy, errorMessage, Field, Input, useCopy, useToast } from '@tapperl/ui';

const copy = defineCopy({
  de: {
    title: 'Einlöse-Code',
    description: 'Kund:innen zeigen dir auf ihrem Handy einen 6-stelligen Code, wenn sie eine Prämie einlösen möchten.',
    label: 'Code vom Kundenhandy',
    placeholder: '000000',
    submit: 'Prämie einlösen',
    incomplete: 'Der Code hat genau 6 Ziffern.',
    restricted: 'Dein Konto ist gerade eingeschränkt – Prämien können erst wieder eingelöst werden, wenn ein Tarif aktiv ist.',
    successTitle: 'Prämie eingelöst',
    successText: (reward: string, name: string) => `${name} bekommt: ${reward}`,
    successBalance: (b: number) => `Neuer Kartenstand: ${b} Stempel`,
    toast: (reward: string, name: string) => `„${reward}“ für ${name} eingelöst.`,
    next: 'Nächster Code',
  },
});

interface RedeemCodeResult {
  transactionId: string;
  balance: number;
  rewardName: string;
  customerName: string;
}

export function RedeemCode({ locationId }: { locationId: string | null }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RedeemCodeResult | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const nextRef = React.useRef<HTMLButtonElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t.incomplete);
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<RedeemCodeResult>('/stamps/redeem-code', { body: { code, locationId } });
      setResult(res);
      setCode('');
      toast.success(t.toast(res.rewardName, res.customerName));
      requestAnimationFrame(() => nextRef.current?.focus());
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'subscription_restricted' ? t.restricted : errorMessage(err));
      inputRef.current?.focus();
      inputRef.current?.select();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader title={t.title} description={t.description} />
      <CardBody>
        <div aria-live="polite">
          {result ? (
            <div className="animate-fade-up rounded-2xl border border-success/30 bg-success-soft p-5 text-center">
              <PartyPopper className="mx-auto size-8 text-success" aria-hidden />
              <p className="mt-2 text-lg font-semibold text-ink">{t.successTitle}</p>
              <p className="mt-1 text-base text-ink">{t.successText(result.rewardName, result.customerName)}</p>
              <p className="mt-1 text-sm text-muted tabular">{t.successBalance(result.balance)}</p>
              <Button
                ref={nextRef}
                variant="outline"
                size="lg"
                className="mt-4 w-full"
                onClick={() => {
                  setResult(null);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                {t.next}
              </Button>
            </div>
          ) : null}
        </div>
        {result ? null : (
          <form method="post" onSubmit={(e) => void submit(e)} className="flex flex-col gap-3" noValidate>
            <Field label={t.label} error={error}>
              <Input
                ref={inputRef}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (error) setError(null);
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                enterKeyHint="done"
                placeholder={t.placeholder}
                className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
              />
            </Field>
            <Button type="submit" variant="honey" size="lg" className="h-14 w-full" loading={loading}>
              {loading ? null : <Gift className="size-5" aria-hidden />}
              {t.submit}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
