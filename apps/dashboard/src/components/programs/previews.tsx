'use client';
import * as React from 'react';
import QRCode from 'qrcode';
import type { CardDesign } from '@tably/types';
import { LoyaltyCard, PhoneFrame, Segmented, StampIcon, type LoyaltyCardData } from '@tably/ui';

export interface PreviewModel {
  organizationName: string;
  cardTitle: string;
  stampsRequired: number;
  stampIcon: string;
  rewardName: string;
  design: CardDesign;
  logoUrl: string | null;
}

export function toCardData(m: PreviewModel, balance: number): LoyaltyCardData {
  return {
    organizationName: m.organizationName,
    cardTitle: m.cardTitle || 'Treuekarte',
    stampsRequired: m.stampsRequired,
    balance,
    stampIcon: m.stampIcon,
    rewardName: m.design.rewardText || m.rewardName || null,
    backgroundColor: m.design.backgroundColor,
    textColor: m.design.textColor,
    accentColor: m.design.accentColor,
    logoUrl: m.design.showLogo ? m.logoUrl : null,
    footerText: m.design.footerText,
  };
}

function useQr(value: string): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { margin: 1, width: 240 }).then((u) => active && setUrl(u)).catch(() => undefined);
    return () => void (active = false);
  }, [value]);
  return url;
}

function AppleWalletPreview({ m, balance }: { m: PreviewModel; balance: number }) {
  const qr = useQr('TABLY-CODE');
  const shown = Math.min(balance, m.stampsRequired);
  const cols = m.stampsRequired <= 6 ? m.stampsRequired : Math.ceil(m.stampsRequired / (m.stampsRequired <= 14 ? 2 : 3));
  return (
    <div className="p-3 pt-10">
      <div className="overflow-hidden rounded-2xl pb-4 shadow-raised" style={{ background: m.design.backgroundColor, color: m.design.textColor }}>
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <p className="truncate text-sm font-semibold">{m.organizationName}</p>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: m.design.accentColor }}>Stempel</p>
            <p className="text-base leading-tight tabular">{balance} / {m.stampsRequired}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-1.5 px-5 py-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, background: 'rgb(0 0 0 / 0.08)' }}>
          {Array.from({ length: m.stampsRequired }, (_, i) => (
            <div key={i} className="mx-auto flex aspect-square w-full max-w-9 items-center justify-center rounded-full" style={i < shown ? { background: m.design.accentColor, color: m.design.backgroundColor } : { border: `1.5px solid color-mix(in srgb, ${m.design.textColor} 45%, transparent)` }}>
              {i < shown ? <StampIcon name={m.stampIcon} className="size-1/2" /> : null}
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: m.design.accentColor }}>Karte</p>
            <p className="truncate text-sm">{m.cardTitle || 'Treuekarte'}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: m.design.accentColor }}>Prämie</p>
            <p className="truncate text-sm">{m.rewardName || '–'}</p>
          </div>
        </div>
        <div className="mx-auto mt-5 w-24 rounded-lg bg-white p-1.5">{qr ? <img src={qr} alt="" className="w-full" /> : <div className="aspect-square" />}</div>
      </div>
    </div>
  );
}

function GoogleWalletPreview({ m, balance }: { m: PreviewModel; balance: number }) {
  const qr = useQr('TABLY-CODE');
  return (
    <div className="p-3 pt-10">
      <div className="overflow-hidden rounded-3xl shadow-raised" style={{ background: m.design.backgroundColor, color: m.design.textColor }}>
        <div className="flex items-center gap-3 px-5 pt-5">
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-xs font-semibold text-black">
            {m.design.showLogo && m.logoUrl ? <img src={m.logoUrl} alt="" className="size-full object-cover" /> : m.organizationName.charAt(0)}
          </div>
          <p className="truncate text-sm">{m.organizationName}</p>
        </div>
        <p className="px-5 pt-4 text-xl font-medium">{m.cardTitle || 'Treuekarte'}</p>
        <div className="px-5 pt-4">
          <p className="text-xs opacity-80">Stempel</p>
          <p className="text-lg tabular">{balance} / {m.stampsRequired}</p>
        </div>
        <div className="mx-auto mb-5 mt-5 w-28 rounded-xl bg-white p-2">{qr ? <img src={qr} alt="" className="w-full" /> : <div className="aspect-square" />}</div>
      </div>
      <div className="mt-3 rounded-2xl bg-surface p-4 text-sm">
        <p className="text-xs text-muted">Prämie</p>
        <p>{m.rewardName || '–'}</p>
      </div>
    </div>
  );
}

type Mode = 'web' | 'apple' | 'google';

/** Live-Vorschau der Karte in drei Darstellungen. */
export function CardPreviews({ model }: { model: PreviewModel }) {
  const [mode, setMode] = React.useState<Mode>('web');
  const [balance, setBalance] = React.useState(() => Math.min(3, model.stampsRequired));
  const safeBalance = Math.min(balance, model.stampsRequired);
  return (
    <div className="flex flex-col items-center gap-4">
      <Segmented<Mode> label="Vorschau" value={mode} onChange={setMode} size="sm" options={[{ value: 'web', label: 'Webkarte' }, { value: 'apple', label: 'Apple Wallet' }, { value: 'google', label: 'Google Wallet' }]} />
      <PhoneFrame label={`Vorschau: ${mode === 'web' ? 'Webkarte' : mode === 'apple' ? 'Apple Wallet' : 'Google Wallet'}`}>
        <div className="min-h-[520px]">
          {mode === 'web' ? (
            <div className="p-3 pt-10">
              <LoyaltyCard compact data={toCardData(model, safeBalance)} />
            </div>
          ) : mode === 'apple' ? (
            <AppleWalletPreview m={model} balance={safeBalance} />
          ) : (
            <GoogleWalletPreview m={model} balance={safeBalance} />
          )}
        </div>
      </PhoneFrame>
      <label className="flex w-full max-w-[320px] items-center gap-3 text-sm text-muted">
        <span className="shrink-0">Beispielstand</span>
        <input type="range" min={0} max={model.stampsRequired} value={safeBalance} onChange={(e) => setBalance(Number(e.currentTarget.value))} className="w-full accent-[var(--brand)]" />
        <span className="w-6 shrink-0 text-right tabular">{safeBalance}</span>
      </label>
      {mode !== 'web' ? <p className="max-w-[320px] text-center text-xs text-subtle">Angenäherte Darstellung. Das genaue Aussehen bestimmt die Wallet-App des jeweiligen Geräts.</p> : null}
    </div>
  );
}

export function QrImage({ value, size = 200, alt }: { value: string; size?: number; alt: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2 }).then((u) => active && setUrl(u)).catch(() => undefined);
    return () => void (active = false);
  }, [value, size]);
  return url ? <img src={url} alt={alt} width={size} height={size} className="rounded-xl border border-line bg-white p-2" /> : <div style={{ width: size, height: size }} className="rounded-xl bg-sunken" aria-hidden />;
}
