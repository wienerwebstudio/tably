'use client';
import * as React from 'react';
import useSWR from 'swr';
import QRCode from 'qrcode';
import { ExternalLink, FlaskConical, Smartphone } from 'lucide-react';
import type { DeviceDto, SimulatedTapDto } from '@tapperl/types';
import { api, Badge, Button, buttonClass, Card, CardBody, CopyButton, defineCopy, errorMessage, Field, Select, Skeleton, useCopy, useToast } from '@tapperl/ui';

const copy = defineCopy({
  de: {
    badge: 'SIMULATION',
    title: 'Tap simulieren',
    description: 'Zum Ausprobieren ohne echten NFC-Stempel. Es entstehen echte Buchungen in deinem Betrieb – sie sind als Simulation gekennzeichnet.',
    device: 'Simulierter Stempel',
    simulate: 'Tap simulieren',
    again: 'Neuen Tap simulieren',
    explain: 'Die URL entspricht dem, was ein echter Stempel liefert, und ist nur einmal gültig.',
    open: 'Auf diesem Gerät öffnen',
    scan: 'Oder mit dem Handy scannen:',
    qrAlt: 'QR-Code mit der simulierten Tap-URL',
    copy: 'URL kopieren',
    localhost: 'Die Adresse zeigt auf „localhost“. Der QR-Code funktioniert deshalb nur auf Geräten, die Tapperl unter dieser Adresse erreichen.',
    created: (n: number) => `Simulierter Tap Nr. ${n} erzeugt.`,
    program: 'Karte',
    noProgram: 'keinem Programm zugeordnet',
  },
});

/** Wird nur angezeigt, wenn es aktive simulierte Stempel gibt. */
export function SimulationPanel() {
  const t = useCopy(copy);
  const toast = useToast();
  const { data } = useSWR<DeviceDto[]>('/devices');
  const devices = React.useMemo(() => (data ?? []).filter((d) => d.kind === 'SIMULATED' && d.status === 'ACTIVE'), [data]);
  const [deviceId, setDeviceId] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [tap, setTap] = React.useState<SimulatedTapDto | null>(null);
  const [qr, setQr] = React.useState<string | null>(null);

  const selected = devices.find((d) => d.id === deviceId) ?? devices[0];

  React.useEffect(() => {
    let cancelled = false;
    setQr(null);
    if (!tap) return;
    QRCode.toDataURL(tap.url, { margin: 1, width: 480, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tap]);

  if (!selected) return null;

  const simulate = async () => {
    setLoading(true);
    try {
      const res = await api<SimulatedTapDto>(`/devices/${selected.id}/simulate-tap`, { method: 'POST' });
      setTap(res);
      toast.info(t.created(res.counter));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  let isLocal = false;
  if (tap) {
    try {
      isLocal = ['localhost', '127.0.0.1'].includes(new URL(tap.url).hostname);
    } catch {
      isLocal = false;
    }
  }

  return (
    <Card className="border-2 border-dashed border-warn/50">
      <div className="flex items-start gap-3 px-5 pt-5 sm:px-6">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warn" className="font-semibold tracking-wider">{t.badge}</Badge>
            <h2 className="text-base font-semibold text-ink">{t.title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted">{t.description}</p>
        </div>
      </div>
      <CardBody className="flex flex-col gap-4">
        {devices.length > 1 ? (
          <Field label={t.device}>
            <Select
              value={selected.id}
              onChange={(e) => {
                setDeviceId(e.target.value);
                setTap(null);
              }}
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.location ? ` · ${d.location.name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="text-sm text-ink">
            <span className="font-medium">{selected.name}</span>
            {selected.location ? <span className="text-muted"> · {selected.location.name}</span> : null}
          </p>
        )}
        <p className="-mt-2 text-xs text-muted">
          {t.program}: {selected.program ? selected.program.name : t.noProgram}
        </p>
        <Button variant="outline" size="lg" className="w-full" onClick={() => void simulate()} loading={loading}>
          {loading ? null : <Smartphone className="size-5" aria-hidden />}
          {tap ? t.again : t.simulate}
        </Button>

        <div aria-live="polite">
          {tap ? (
            <div className="animate-fade-up flex flex-col gap-3 rounded-xl border border-line bg-paper p-4">
              <p className="text-sm text-muted">{t.explain}</p>
              <a href={tap.url} target="_blank" rel="noreferrer" className={buttonClass({ size: 'lg', className: 'w-full' })}>
                <ExternalLink className="size-4" aria-hidden />
                {t.open}
              </a>
              <p className="text-sm font-medium text-ink">{t.scan}</p>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={t.qrAlt} width={240} height={240} className="mx-auto size-60 max-w-full rounded-xl border border-line bg-white p-2" />
              ) : (
                <Skeleton className="mx-auto size-60 rounded-xl" />
              )}
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-sunken px-2.5 py-1.5 font-mono text-xs text-muted">{tap.url}</code>
                <CopyButton value={tap.url} label={t.copy} className="shrink-0" />
              </div>
              {isLocal ? <p className="text-xs text-muted">{t.localhost}</p> : null}
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
