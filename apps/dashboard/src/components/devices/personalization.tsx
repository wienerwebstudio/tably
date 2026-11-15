'use client';
import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { PersonalizationDto } from '@tapperl/types';
import { Alert, api, Button, CopyButton, defineCopy, Dialog, useCopy } from '@tapperl/ui';
import { useSubmit } from '@/lib/use-submit';

const copy = defineCopy({
  de: {
    warnTitle: 'Personalisierungsdaten anzeigen',
    warnLead: 'Du siehst gleich die geheimen Schlüssel dieses Stempels.',
    warnPoints: [
      'Wer die Schlüssel kennt, kann gültige Taps fälschen. Gib sie nur an die Person weiter, die den Chip beschreibt.',
      'Schicke sie nicht per E-Mail oder Chat und speichere keine Bildschirmfotos.',
      'Jeder Abruf wird mit deinem Namen und der Uhrzeit protokolliert.',
    ],
    cancel: 'Abbrechen',
    reveal: 'Verstanden, Daten anzeigen',
    dataTitle: 'Personalisierungsdaten',
    dataDescription: 'Diese Werte trägst du in das Programm deines NFC-Schreibgeräts ein (z. B. NXP TagXplorer).',
    logged: 'Dieser Abruf wurde im Geräteprotokoll vermerkt.',
    url: 'URL-Vorlage (NDEF)',
    urlHint: 'Die Nullen sind Platzhalter – der Chip ersetzt sie bei jedem Tap durch neue Werte.',
    payload: 'NDEF-Nutzdaten ohne „https://“',
    prefix: 'URI-Präfixcode',
    offsets: 'Offsets in der NDEF-Datei',
    piccOffset: 'PICCData-Offset',
    macOffset: 'SDMMAC-Offset',
    macInputOffset: 'SDMMAC-Input-Offset',
    keyNumbers: 'Schlüsselnummern',
    metaKeyNo: 'SDMMetaRead',
    fileKeyNo: 'SDMFileRead',
    ctrKeyNo: 'SDMCtrRet (Zählerabruf)',
    settings: 'SDM-Einstellungen',
    settingsText: 'SDM aktiv · UID-Spiegelung an · Lesezähler-Spiegelung an · PICCData verschlüsselt',
    keys: 'AES-Schlüssel (geheim)',
    metaKey: 'Schlüssel 1 – SDMMetaRead',
    fileKey: 'Schlüssel 2 – SDMFileRead',
    keyVersion: 'Schlüsselversion',
    publicId: 'Gerätekennung',
    show: 'Einblenden',
    hide: 'Verbergen',
    hidden: 'verdeckt',
    copy: 'Kopieren',
    profileMissing: 'Die URL-Vorlage konnte nicht erzeugt werden',
    profileMissingText: 'Die Schlüssel sind gültig, aber ohne passende Adresse kannst du noch keinen Chip für den echten Betrieb beschreiben.',
    close: 'Schließen',
    after: 'Nach dem Beschreiben: Halte den Stempel einmal an ein Smartphone. Der erste gültige Tap aktiviert ihn.',
  },
});

function Value({ label, value, mono = true, hint }: { label: string; value: string; mono?: boolean; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-subtle">{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className={mono ? 'min-w-0 flex-1 break-all rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink' : 'min-w-0 flex-1 text-sm text-ink'}>{value}</code>
        <CopyButton value={value} className="shrink-0" />
      </div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function SecretValue({ label, value, t }: { label: string; value: string; t: (typeof copy)['de'] }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-subtle">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 basis-56 break-all rounded-lg bg-sunken px-3 py-2 font-mono text-xs text-ink" aria-label={visible ? undefined : `${label}: ${t.hidden}`}>
          {visible ? value : '•'.repeat(32)}
        </code>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-sunken"
        >
          {visible ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
          {visible ? t.hide : t.show}
        </button>
        <CopyButton value={value} className="shrink-0" />
      </div>
    </div>
  );
}

function Num({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-sunken px-3 py-2">
      <p className="text-xs text-subtle">{label}</p>
      <p className="font-mono text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

/**
 * Zweistufiger Dialog: erst Warnhinweis, dann die Werte. Die Schlüssel liegen
 * nur im Zustand dieses Dialogs und werden beim Schließen verworfen.
 */
export function PersonalizationDialog({ deviceId, open, onOpenChange, onRevealed }: { deviceId: string; open: boolean; onOpenChange: (o: boolean) => void; onRevealed: () => void }) {
  const t = useCopy(copy);
  const [data, setData] = React.useState<PersonalizationDto | null>(null);
  const request = useSubmit(() => api<PersonalizationDto>(`/devices/${deviceId}/personalization`, { method: 'POST' }));

  React.useEffect(() => {
    if (!open) {
      setData(null);
      request.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function reveal() {
    const result = await request.submit();
    if (result) {
      setData(result);
      onRevealed();
    }
  }

  if (!data) {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        title={t.warnTitle}
        description={t.warnLead}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button loading={request.loading} onClick={() => void reveal()}>
              {t.reveal}
            </Button>
          </>
        }
      >
        <Alert tone="warn">
          <ul className="list-disc space-y-1.5 pl-4">
            {t.warnPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
        {request.error ? (
          <Alert tone="danger" className="mt-3">
            {request.error}
          </Alert>
        ) : null}
      </Dialog>
    );
  }

  const s = data.profile?.settings ?? {};
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title={t.dataTitle} description={t.dataDescription} footer={<Button onClick={() => onOpenChange(false)}>{t.close}</Button>}>
      <div className="flex flex-col gap-5">
        {data.warning ? (
          <Alert tone="warn" title={t.profileMissing}>
            <p>{data.warning}</p>
            <p className="mt-1">{t.profileMissingText}</p>
          </Alert>
        ) : null}

        {data.profile ? (
          <>
            <Value label={t.url} value={data.profile.urlTemplate} hint={t.urlHint} />
            <Value label={t.payload} value={data.profile.ndefUriPayload} />
            <div>
              <p className="mb-1.5 text-xs font-medium text-subtle">{t.offsets}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Num label={t.prefix} value={`0x${data.profile.uriPrefixCode.toString(16).padStart(2, '0').toUpperCase()}`} />
                <Num label={t.piccOffset} value={data.profile.piccDataOffset} />
                <Num label={t.macOffset} value={data.profile.sdmMacOffset} />
                <Num label={t.macInputOffset} value={data.profile.sdmMacInputOffset} />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-subtle">{t.keyNumbers}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Num label={t.metaKeyNo} value={String(s.sdmMetaReadKeyNo ?? '–')} />
                <Num label={t.fileKeyNo} value={String(s.sdmFileReadKeyNo ?? '–')} />
                <Num label={t.ctrKeyNo} value={String(s.sdmCtrRetKeyNo ?? '–')} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {t.settings}: {t.settingsText}
              </p>
            </div>
          </>
        ) : null}

        <div className="rounded-xl border border-line p-4">
          <p className="mb-3 text-sm font-semibold text-ink">{t.keys}</p>
          <div className="flex flex-col gap-4">
            <SecretValue label={t.metaKey} value={data.keys.sdmMetaReadKey} t={t} />
            <SecretValue label={t.fileKey} value={data.keys.sdmFileReadKey} t={t} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {t.publicId}: <span className="font-mono">{data.publicId}</span> · {t.keyVersion}: {data.keyVersion}
          </p>
        </div>

        <p className="text-sm text-muted">{t.after}</p>
        <p className="text-xs text-subtle">{t.logged}</p>
      </div>
    </Dialog>
  );
}
