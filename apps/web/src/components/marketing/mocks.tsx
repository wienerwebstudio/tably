import * as React from 'react';
import { Cake, Check, Clock, Gift, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Badge, cn, LoyaltyCard } from '@tapperl/ui';
import { HERO_CARD } from './site';

/*
 * Ausschnitte aus dem Dashboard als gebaute Komponenten. Alle Inhalte sind
 * Beispieldaten und als solche gekennzeichnet.
 */

export function MockFrame({ title, children, className, note = 'Beispieldaten' }: { title: string; children: React.ReactNode; className?: string; note?: string | null }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-raised', className)} aria-hidden>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="truncate text-[13px] font-semibold text-ink">{title}</p>
        {note ? <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-subtle">{note}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-semibold text-muted', className)}>{name.charAt(0)}</span>;
}

export function TapFeedMock({ className }: { className?: string }) {
  return (
    <MockFrame title="Theke · Live" className={className}>
      <ul className="divide-y divide-line text-sm">
        <li className="flex items-center gap-3 px-4 py-3">
          <Avatar name="Jonas" className="bg-honey-soft text-honey" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">Jonas</p>
            <p className="truncate text-xs text-muted">Wartet auf Freigabe</p>
          </div>
          <span className="hidden size-8 items-center justify-center rounded-lg border border-line-strong text-muted min-[420px]:flex">
            <X className="size-4" />
          </span>
          <span className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-on-brand">
            <Check className="size-3.5" strokeWidth={3} />
            Freigeben
          </span>
        </li>
        <li className="flex items-center gap-3 px-4 py-3">
          <Avatar name="Lena" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">Lena</p>
            <p className="truncate text-xs text-muted">Kaffeekarte · 8 von 10</p>
          </div>
          <Badge tone="success" dot>
            gebucht
          </Badge>
        </li>
        <li className="flex items-center gap-3 px-4 py-3">
          <Avatar name="?" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">Unbekannt</p>
            <p className="truncate text-xs text-muted">Link wurde bereits verwendet</p>
          </div>
          <Badge tone="danger" dot>
            abgelehnt
          </Badge>
        </li>
        <li className="flex items-center gap-3 px-4 py-3">
          <Avatar name="Mira" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">Mira</p>
            <p className="truncate text-xs text-muted">Tageslimit erreicht</p>
          </div>
          <Badge tone="warn" dot>
            nicht gebucht
          </Badge>
        </li>
      </ul>
    </MockFrame>
  );
}

const BARS = [38, 52, 47, 64, 83, 100, 58];
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function AnalyticsMock({ className }: { className?: string }) {
  return (
    <MockFrame title="Analysen · Stempel je Wochentag" className={className}>
      <div className="p-4">
        <div className="flex h-32 items-end gap-2.5">
          {BARS.map((h, i) => (
            <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1.5">
              <div className={cn('rounded-t-md', i === 5 ? 'bg-honey' : 'bg-brand/80')} style={{ height: `${h}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2.5 border-t border-line pt-2">
          {DAYS.map((d) => (
            <span key={d} className="flex-1 text-center text-[11px] text-subtle">
              {d}
            </span>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-xs min-[420px]:grid-cols-3">
          {[
            ['Aktive Karten', 'mit Stempel im Zeitraum'],
            ['Wiederkehrquote', 'kommen erneut'],
            ['Prämien', 'eingelöst'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-sunken p-2.5">
              <dt className="font-semibold text-ink">{k}</dt>
              <dd className="mt-0.5 leading-snug text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </MockFrame>
  );
}

export function CampaignMock({ className }: { className?: string }) {
  const rows = [
    { icon: Cake, title: 'Geburtstagsgruß', sub: 'Automatisch am Geburtstag', badge: <Badge tone="success" dot>aktiv</Badge> },
    { icon: RotateCcw, title: 'Schön, dich wiederzusehen', sub: 'Nach 60 Tagen ohne Besuch', badge: <Badge tone="success" dot>aktiv</Badge> },
    { icon: Sparkles, title: 'Doppelte Stempel am Dienstag', sub: 'Bonus-Stempel · nur dienstags', badge: <Badge tone="info" dot>geplant</Badge> },
    { icon: Gift, title: 'Neue Sommerkarte', sub: 'Angebot · an alle mit Einwilligung', badge: <Badge>Entwurf</Badge> },
  ];
  return (
    <MockFrame title="Marketing · Kampagnen" className={className}>
      <ul className="divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <r.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{r.title}</p>
              <p className="truncate text-xs text-muted">{r.sub}</p>
            </div>
            {r.badge}
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

export function PolicyMock({ className }: { className?: string }) {
  const options = [
    { title: 'Automatisch mit Limits', sub: 'Gültiger Tap bucht sofort. Tageslimit je Karte, Auffälligkeiten werden markiert.', icon: ShieldCheck },
    { title: 'Freigabe durch das Team', sub: 'Jeder Tap erscheint an der Theke und wird mit einem Klick bestätigt.', icon: Check },
    { title: 'Kassen-Ereignis', sub: 'Gebucht wird nur, wenn die Kasse kurz zuvor einen Bon gemeldet hat.', icon: Clock },
  ];
  return (
    <MockFrame title="Kartenprogramm · Buchungsrichtlinie" note={null} className={className}>
      <div className="space-y-2 p-3">
        {options.map((o, i) => (
          <div key={o.title} className={cn('flex gap-3 rounded-xl border p-3', i === 1 ? 'border-brand bg-brand-soft/60' : 'border-line')}>
            <span className={cn('mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2', i === 1 ? 'border-brand' : 'border-line-strong')}>
              {i === 1 ? <span className="size-2 rounded-full bg-brand" /> : null}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{o.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{o.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

export function CustomersMock({ className }: { className?: string }) {
  const rows = [
    ['Lena', 'Kaffeekarte', '8 / 10', 'heute'],
    ['Jonas', 'Kaffeekarte', '3 / 10', 'heute'],
    ['Mira', 'Bohnenkarte', '5 / 6', 'vor 2 Tagen'],
    ['Tarek', 'Kaffeekarte', '10 / 10', 'vor 5 Tagen'],
  ];
  return (
    <MockFrame title="Kund:innen" className={className}>
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-center gap-x-4 px-4 text-sm">
        {['Name', 'Karte', 'Stand', 'Zuletzt'].map((h, i) => (
          <span key={h} className={cn('border-b border-line py-2.5 text-[11px] font-semibold uppercase tracking-wider text-subtle', i === 3 && 'hidden text-right min-[420px]:block', i === 2 && 'text-right')}>
            {h}
          </span>
        ))}
        {rows.map((r) => (
          <React.Fragment key={r[0]}>
            <span className="flex min-w-0 items-center gap-2.5 py-2.5">
              <Avatar name={r[0]!} className="size-7" />
              <span className="truncate font-medium text-ink">{r[0]}</span>
            </span>
            <span className="truncate text-muted">{r[1]}</span>
            <span className="tabular text-right text-ink">{r[2]}</span>
            <span className="hidden text-right text-muted min-[420px]:block">{r[3]}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="h-2" />
    </MockFrame>
  );
}

export function DesignerMock({ className }: { className?: string }) {
  const swatches = ['#F6F1E7', '#1F3A2E', '#7A2E22', '#16223B', '#FBEAF0'];
  return (
    <MockFrame title="Karten-Designer" note={null} className={className}>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[8.25rem_minmax(0,1fr)] sm:items-center">
        <div className="space-y-3.5 text-xs">
          <div>
            <p className="font-medium text-muted">Hintergrund</p>
            <div className="mt-1.5 flex gap-1.5">
              {swatches.map((c, i) => (
                <span key={c} className={cn('size-6 rounded-full border border-line-strong', i === 0 && 'ring-2 ring-brand ring-offset-2 ring-offset-surface')} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <p className="font-medium text-muted">Stempel bis zur Prämie</p>
            <div className="mt-1.5 flex h-8 items-center justify-between rounded-lg border border-line-strong px-2.5 text-sm text-ink">
              10 <span className="text-subtle">Stempel</span>
            </div>
          </div>
          <div>
            <p className="font-medium text-muted">Prämie</p>
            <div className="mt-1.5 flex h-8 items-center rounded-lg border border-line-strong px-2.5 text-sm text-ink">Gratis Kaffee</div>
          </div>
        </div>
        <LoyaltyCard compact className="rounded-[22px] shadow-raised" data={{ ...HERO_CARD, balance: 6 }} />
      </div>
    </MockFrame>
  );
}

export function TeamMock({ className }: { className?: string }) {
  const rows = [
    ['Anna', 'Inhaberin', 'Alles, inklusive Tarif und Abrechnung'],
    ['Deniz', 'Admin', 'Alles außer Tarif und Abrechnung'],
    ['Kim', 'Manager:in', 'Karten, Stempel, Kampagnen, Analysen'],
    ['Paul', 'Mitarbeiter:in', 'Stempeln und Kund:innen ansehen'],
  ];
  return (
    <MockFrame title="Team & Rollen" className={className}>
      <ul className="divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r[0]} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={r[0]!} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{r[0]}</p>
              <p className="truncate text-xs text-muted">{r[2]}</p>
            </div>
            <Badge tone={r[1] === 'Inhaberin' ? 'brand' : 'neutral'}>{r[1]}</Badge>
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

export function DevicesMock({ className }: { className?: string }) {
  const rows = [
    { name: 'Stempel Theke', sub: 'Hauptstandort · zuletzt genutzt heute', badge: <Badge tone="success" dot>aktiv</Badge> },
    { name: 'Stempel Terrasse', sub: 'Hauptstandort · zuletzt genutzt gestern', badge: <Badge tone="success" dot>aktiv</Badge> },
    { name: 'Stempel alt', sub: 'als verloren gemeldet', badge: <Badge tone="danger" dot>gesperrt</Badge> },
  ];
  return (
    <MockFrame title="NFC-Stempel" className={className}>
      <ul className="divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sunken">
              <svg viewBox="0 0 20 24" className="h-5 text-ink" fill="currentColor">
                <path d="M6 1h8a2 2 0 0 1 2 2v4c0 3-3 4-3 7 0 2 2 3 2 5H5c0-2 2-3 2-5 0-3-3-4-3-7V3a2 2 0 0 1 2-2ZM2 20h16v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2Z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{r.name}</p>
              <p className="truncate text-xs text-muted">{r.sub}</p>
            </div>
            {r.badge}
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

export function ApiMock({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-[#2a2e32] bg-[#15181b] shadow-raised', className)}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-[13px] font-semibold text-white/90">Kassen-Ereignis melden</p>
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/45">HTTP</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-white/85" tabIndex={0} aria-label="Beispielaufruf der Kassen-Schnittstelle">
        <code>
          <span className="text-[#e8b86d]">POST</span> /integrations/pos/events{'\n'}
          <span className="text-white/50">Authorization:</span> Bearer &lt;API-Schlüssel&gt;{'\n'}
          {'\n'}
          {'{'}
          {'\n'}  <span className="text-[#8fc9a8]">&quot;externalId&quot;</span>: &quot;bon-2026-004211&quot;,{'\n'}  <span className="text-[#8fc9a8]">&quot;amountCents&quot;</span>: 480,{'\n'}  <span className="text-[#8fc9a8]">&quot;currency&quot;</span>: &quot;EUR&quot;{'\n'}
          {'}'}
        </code>
      </pre>
    </div>
  );
}

export function TapCheckMock({ className }: { className?: string }) {
  const rows = [
    { n: '000412', text: 'Signatur gültig, Zähler neu', result: 'angenommen', ok: true },
    { n: '000412', text: 'Derselbe Link, zweiter Aufruf', result: 'abgelehnt', ok: false },
    { n: '000391', text: 'Veralteter Zählerstand', result: 'abgelehnt', ok: false },
    { n: '000413', text: 'Signatur gültig, Zähler neu', result: 'angenommen', ok: true },
  ];
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur', className)} aria-hidden>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-[13px] font-semibold text-white">Tap-Prüfung</p>
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">Schema</span>
      </div>
      <ul className="divide-y divide-white/10 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="tabular shrink-0 rounded-md bg-black/25 px-2 py-1 font-mono text-[12px] text-white/80">#{r.n}</span>
            <span className="min-w-0 flex-1 truncate text-white/80">{r.text}</span>
            <span className={cn('flex shrink-0 items-center gap-1.5 text-xs font-semibold', r.ok ? 'text-[#8fd9ae]' : 'text-[#ffb3a8]')}>
              {r.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
              {r.result}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
