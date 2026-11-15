'use client';
import * as React from 'react';
import QRCode from 'qrcode';
import { ExternalLink, FlaskConical } from 'lucide-react';
import type { SimulatedTapDto } from '@tapperl/types';
import { Alert, api, Badge, Button, buttonClass, Card, CardBody, CardHeader, CopyButton, defineCopy, Skeleton, useCopy, useToast } from '@tapperl/ui';
import { useSubmit } from '@/lib/use-submit';

const copy = defineCopy({
  de: {
    title: 'Tap simulieren',
    badge: 'SIMULATION',
    text: 'Dieser Stempel ist kein echter Chip. Mit einem Klick erzeugst du den Link, den ein echter Stempel beim Antippen an das Smartphone übergeben würde. Alles danach läuft genauso ab wie im echten Betrieb – der Stempel wird wirklich gebucht.',
    button: 'Tap simulieren',
    again: 'Neuen Tap erzeugen',
    disabled: 'Der Simulationsmodus ist auf diesem System nicht aktiviert.',
    inactive: 'Aktiviere den Stempel, um Taps zu simulieren.',
    resultTitle: 'Simulierter Tap',
    counter: 'Zählerstand',
    scan: 'Scanne den Code mit der Smartphone-Kamera – oder öffne den Link direkt.',
    qrAlt: 'QR-Code mit dem Link des simulierten Taps',
    open: 'Auf diesem Gerät öffnen',
    copy: 'Link kopieren',
    once: 'Jeder Link gilt nur einmal. Für einen weiteren Stempel erzeugst du einen neuen Tap.',
    created: 'Simulierter Tap erzeugt.',
  },
});

export function SimulateTapCard({ deviceId, enabled, active, onTapped }: { deviceId: string; enabled: boolean; active: boolean; onTapped: () => void }) {
  const t = useCopy(copy);
  const toast = useToast();
  const [tap, setTap] = React.useState<SimulatedTapDto | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const request = useSubmit(() => api<SimulatedTapDto>(`/devices/${deviceId}/simulate-tap`, { method: 'POST' }));

  React.useEffect(() => {
    let cancelled = false;
    setQr(null);
    if (tap) {
      QRCode.toDataURL(tap.url, { margin: 1, width: 440, errorCorrectionLevel: 'M' })
        .then((url) => {
          if (!cancelled) setQr(url);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [tap]);

  async function simulate() {
    const result = await request.submit();
    if (result) {
      setTap(result);
      toast.success(t.created);
      onTapped();
    }
  }

  return (
    <Card className="border-honey/40">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <FlaskConical className="size-4 text-honey" aria-hidden />
            {t.title}
            <Badge tone="honey">{t.badge}</Badge>
          </span>
        }
        description={t.text}
      />
      <CardBody>
        {!enabled ? (
          <Alert tone="info">{t.disabled}</Alert>
        ) : !active ? (
          <Alert tone="info">{t.inactive}</Alert>
        ) : (
          <>
            {request.error ? (
              <Alert tone="danger" className="mb-4">
                {request.error}
              </Alert>
            ) : null}
            <Button variant={tap ? 'outline' : 'honey'} loading={request.loading} onClick={() => void simulate()}>
              {tap ? t.again : t.button}
            </Button>

            {tap ? (
              <div className="mt-5 flex flex-col gap-5 rounded-xl border border-dashed border-honey/50 bg-honey-soft/40 p-4 sm:flex-row" aria-live="polite">
                <div className="mx-auto shrink-0 rounded-xl bg-white p-2 sm:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {qr ? <img src={qr} alt={t.qrAlt} width={176} height={176} className="size-44" /> : <Skeleton className="size-44" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                    {t.resultTitle}
                    <Badge tone="honey">{t.badge}</Badge>
                    <span className="font-normal text-muted">
                      {t.counter} {tap.counter}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted">{t.scan}</p>
                  <code className="mt-3 block break-all rounded-lg bg-surface px-3 py-2 font-mono text-xs text-ink">{tap.url}</code>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={tap.url} target="_blank" rel="noreferrer" className={buttonClass({ size: 'sm' })}>
                      <ExternalLink className="size-3.5" aria-hidden />
                      {t.open}
                    </a>
                    <CopyButton value={tap.url} label={t.copy} />
                  </div>
                  <p className="mt-3 text-xs text-muted">{t.once}</p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
