'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ChevronRight, Nfc, Plus } from 'lucide-react';
import type { DeviceDetailDto, DeviceDto } from '@tapperl/types';
import { Badge, Button, Card, defineCopy, EmptyState, ErrorState, formatRelative, PageHeader, Skeleton, Table, Td, Th, useCopy, useToast } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { deviceSecurity, deviceStatus } from '@/lib/labels';
import { kindShort } from '@/components/devices/labels';
import { RegisterDeviceDialog } from '@/components/devices/register-dialog';

const copy = defineCopy({
  de: {
    title: 'NFC-Stempel',
    description: 'Deine Stempel an der Theke: Kunden halten ihr Smartphone daran und sammeln so ihre Stempel.',
    register: 'Stempel registrieren',
    emptyTitle: 'Noch kein Stempel registriert',
    emptyText: 'Registriere deinen Stempel hier und richte den Chip einmalig mit den Werten ein, die Tapperl dir anzeigt. Danach hältst du ihn einmal an ein Smartphone – der erste gültige Tap nimmt ihn in Betrieb.',
    errorText: 'Die Stempel konnten nicht geladen werden.',
    colName: 'Name',
    colKind: 'Art',
    colStatus: 'Status',
    colSecurity: 'Sicherheit',
    colLocation: 'Standort',
    colProgram: 'Programm',
    colLastUsed: 'Zuletzt verwendet',
    colStamps: 'Stempel (7 Tage)',
    none: '–',
    noProgram: 'Nicht zugeordnet',
    stamps7d: 'Stempel in 7 Tagen',
    lastUsed: 'Zuletzt',
    open: 'Details öffnen',
    created: 'Stempel registriert.',
    retiredNote: 'Außer Betrieb genommene Stempel werden hier nicht mehr angezeigt.',
  },
});

function Row({ device, t }: { device: DeviceDto; t: (typeof copy)['de'] }) {
  return (
    <tr className="group hover:bg-sunken/50">
      <Td>
        <Link href={`/stempel/${device.id}`} className="font-medium hover:underline">
          {device.name}
        </Link>
      </Td>
      <Td className="whitespace-nowrap text-muted">{device.kind === 'SIMULATED' ? <Badge tone="honey">{kindShort.SIMULATED}</Badge> : kindShort[device.kind]}</Td>
      <Td>
        <Badge tone={deviceStatus[device.status].tone} dot>
          {deviceStatus[device.status].label}
        </Badge>
      </Td>
      <Td>
        <Badge tone={deviceSecurity[device.securityStatus].tone}>{deviceSecurity[device.securityStatus].label}</Badge>
      </Td>
      <Td className="text-muted">{device.location?.name ?? t.none}</Td>
      <Td className="text-muted">{device.program?.name ?? t.noProgram}</Td>
      <Td className="whitespace-nowrap text-muted">{formatRelative(device.lastUsedAt)}</Td>
      <Td className="text-right font-semibold tabular">{(device.stamps7d ?? 0).toLocaleString('de-DE')}</Td>
    </tr>
  );
}

export default function DevicesPage() {
  const t = useCopy(copy);
  const { can } = useSession();
  const router = useRouter();
  const toast = useToast();
  const devices = useSWR<DeviceDto[]>('/devices');
  const [open, setOpen] = React.useState(false);
  // Ob Simulation erlaubt ist, verrät nur die Detailantwort eines Geräts.
  const firstId = devices.data?.[0]?.id;
  const probe = useSWR<DeviceDetailDto>(firstId && can('devices.manage') ? `/devices/${firstId}` : null);
  const allowSimulated = probe.data ? probe.data.simulatorEnabled : !firstId || Boolean(devices.data?.some((d) => d.kind === 'SIMULATED'));

  const registerButton = can('devices.manage') ? (
    <Button onClick={() => setOpen(true)}>
      <Plus className="size-4" aria-hidden />
      {t.register}
    </Button>
  ) : undefined;

  return (
    <>
      <PageHeader title={t.title} description={t.description} actions={registerButton} />

      {devices.error ? (
        <Card>
          <ErrorState description={t.errorText} onRetry={() => void devices.mutate()} />
        </Card>
      ) : !devices.data ? (
        <Card className="p-5">
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </Card>
      ) : devices.data.length === 0 ? (
        <Card>
          <EmptyState icon={<Nfc />} title={t.emptyTitle} description={t.emptyText} action={registerButton} />
        </Card>
      ) : (
        <>
          {/* Mobil: Karten statt breiter Tabelle */}
          <ul className="flex flex-col gap-3 md:hidden">
            {devices.data.map((d) => (
              <li key={d.id}>
                <Link href={`/stempel/${d.id}`} className="block rounded-2xl border border-line bg-surface p-4 shadow-card hover:border-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{d.name}</p>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {kindShort[d.kind]} · {d.location?.name ?? t.none} · {d.program?.name ?? t.noProgram}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-label={t.open} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone={deviceStatus[d.status].tone} dot>
                      {deviceStatus[d.status].label}
                    </Badge>
                    <Badge tone={deviceSecurity[d.securityStatus].tone}>{deviceSecurity[d.securityStatus].label}</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-subtle">{t.stamps7d}</dt>
                      <dd className="font-semibold tabular">{(d.stamps7d ?? 0).toLocaleString('de-DE')}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-subtle">{t.lastUsed}</dt>
                      <dd>{formatRelative(d.lastUsedAt)}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>{t.colName}</Th>
                  <Th>{t.colKind}</Th>
                  <Th>{t.colStatus}</Th>
                  <Th>{t.colSecurity}</Th>
                  <Th>{t.colLocation}</Th>
                  <Th>{t.colProgram}</Th>
                  <Th>{t.colLastUsed}</Th>
                  <Th className="text-right">{t.colStamps}</Th>
                </tr>
              </thead>
              <tbody>
                {devices.data.map((d) => (
                  <Row key={d.id} device={d} t={t} />
                ))}
              </tbody>
            </Table>
          </Card>
          <p className="mt-3 text-xs text-subtle">{t.retiredNote}</p>
        </>
      )}

      <RegisterDeviceDialog
        open={open}
        onOpenChange={setOpen}
        allowSimulated={allowSimulated}
        onCreated={(detail) => {
          setOpen(false);
          toast.success(t.created);
          void devices.mutate();
          router.push(`/stempel/${detail.device.id}`);
        }}
      />
    </>
  );
}
