'use client';
import * as React from 'react';
import QRCode from 'qrcode';
import { Alert, api, Button, CopyButton, defineCopy, Dialog, formatDateTime, Skeleton, useCopy } from '@tapperl/ui';
import { useSubmit } from '@/lib/use-submit';

interface ProvisioningCode {
  code: string;
  expiresAt: string;
  appUrl: string;
  webUrl: string;
}

const copy = defineCopy({
  de: {
    title: 'Mit dem Android-Handy einrichten',
    description: 'Die Tapperl-Einrichtungs-App beschreibt den NTAG-424-DNA-Chip direkt über das NFC deines Handys – ohne extra Schreibgerät.',
    steps: [
      'Scanne den QR-Code mit dem Android-Handy (oder öffne die App und tippe den Code ein).',
      'Tippe in der App auf „Einrichten“ und halte den Chip flach an die Rückseite des Handys, bis „Fertig“ erscheint.',
      'Der Stempel ist danach sofort aktiv.',
    ],
    code: 'Einrichtungscode',
    valid: (d: string) => `Gültig bis ${d} · nur für diesen Stempel · einmal verwendbar`,
    qrAlt: 'QR-Code zur Einrichtung',
    secret: 'Der Code gibt Zugriff auf die Schlüssel dieses Stempels. Zeig ihn nur der Person, die den Chip einrichtet. Ein neuer Code macht den alten ungültig.',
    noApp: 'App noch nicht installiert? Die Einrichtungsseite hinter dem QR-Code erklärt die Installation.',
    renew: 'Neuen Code erzeugen',
    close: 'Schließen',
  },
});

export function AppSetupDialog({ deviceId, open, onOpenChange, onCreated }: { deviceId: string; open: boolean; onOpenChange: (o: boolean) => void; onCreated?: () => void }) {
  const t = useCopy(copy);
  const [data, setData] = React.useState<ProvisioningCode | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);
  const request = useSubmit(() => api<ProvisioningCode>(`/devices/${deviceId}/provisioning`, { method: 'POST' }));

  const create = React.useCallback(async () => {
    setData(null);
    setQr(null);
    const result = await request.submit();
    if (result) {
      setData(result);
      onCreated?.();
      QRCode.toDataURL(result.webUrl, { margin: 1, width: 440 }).then(setQr).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  React.useEffect(() => {
    if (open) void create();
    else {
      setData(null);
      setQr(null);
      request.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button variant="outline" onClick={() => void create()} loading={request.loading}>
            {t.renew}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t.close}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {request.error ? <Alert tone="danger">{request.error}</Alert> : null}
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          {t.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line p-4">
          {qr ? <img src={qr} alt={t.qrAlt} width={220} height={220} className="rounded-lg" /> : <Skeleton className="size-[220px]" />}
          <div className="text-center">
            <p className="text-xs font-medium text-subtle">{t.code}</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <code className="font-mono text-2xl font-semibold tracking-widest text-ink" data-testid="provisioning-code">
                {data?.code ?? '·····-·····'}
              </code>
              {data ? <CopyButton value={data.code} /> : null}
            </div>
            {data ? <p className="mt-1 text-xs text-muted">{t.valid(formatDateTime(data.expiresAt))}</p> : null}
          </div>
        </div>
        <Alert tone="warn">{t.secret}</Alert>
        <p className="text-xs text-subtle">{t.noApp}</p>
      </div>
    </Dialog>
  );
}
