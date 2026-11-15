import * as React from 'react';
import { cn } from '@tapperl/ui';

/*
 * Der Tapperl-Stempel als Zeichnung. Maßstab 4 Einheiten = 1 mm, Achse bei x = 100,
 * Stempelfläche bei y = 330. Proportionen nach hardware/drawings/massskizze.svg:
 * Ø 44 × 80 mm, Knauf Ø 34, Taille Ø 19, Bund Ø 30, Fuß 18 mm, Kappe 7,8 mm.
 */
const HANDLE = 'M40 258 L40 247 C40 222 62 200 62 152 C62 112 32 100 32 70 L32 30 Q32 11 51 10 L149 10 Q168 11 168 30 L168 70 C168 100 138 112 138 152 C138 200 160 222 160 247 L160 258 Z';
const FOOT = 'M12 299 L12 287 L36 258 L164 258 L188 287 L188 299 Z';
const FLUTES = [22, 33, 46, 61, 77, 100, 123, 139, 154, 167, 178];

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-wood`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#d9bd8f" />
        <stop offset="0.28" stopColor="#f0dcb8" />
        <stop offset="0.62" stopColor="#dcc093" />
        <stop offset="1" stopColor="#b8935f" />
      </linearGradient>
      <linearGradient id={`${id}-green`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#254837" />
        <stop offset="0.3" stopColor="#34604b" />
        <stop offset="0.65" stopColor="#1f3a2e" />
        <stop offset="1" stopColor="#12241b" />
      </linearGradient>
      <linearGradient id={`${id}-cap`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#1c3529" />
        <stop offset="0.3" stopColor="#2a4f3d" />
        <stop offset="0.65" stopColor="#182e24" />
        <stop offset="1" stopColor="#0d1a14" />
      </linearGradient>
    </defs>
  );
}

function HandlePart({ id, stud }: { id: string; stud?: boolean }) {
  return (
    <g>
      {stud ? (
        <g>
          <rect x="68" y="256" width="64" height="40" rx="5" fill={`url(#${id}-wood)`} />
          {[267, 277, 287].map((y) => (
            <path key={y} d={`M68 ${y} Q100 ${y + 7} 132 ${y}`} fill="none" stroke="#9c7a48" strokeOpacity="0.55" strokeWidth="1.6" />
          ))}
        </g>
      ) : null}
      <path d={HANDLE} fill={`url(#${id}-wood)`} />
      {/* Lichtkante am Knauf und feine Fuge zum Bund */}
      <path d="M44 34 L44 68" stroke="#fff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" />
      <path d="M41 247 L159 247" stroke="#9c7a48" strokeOpacity="0.45" strokeWidth="1.2" />
    </g>
  );
}

function LogoDisc(_: { id: string }) {
  return (
    <g>
      <rect x="52" y="5" width="96" height="9" rx="3" fill="#c98a2b" />
      <rect x="52" y="5" width="96" height="3.5" rx="1.75" fill="#e2ad5c" />
    </g>
  );
}

function FootPart({ id, neck }: { id: string; neck?: boolean }) {
  return (
    <g>
      {neck ? (
        <g>
          <rect x="22" y="297" width="156" height="26" rx="4" fill={`url(#${id}-green)`} />
          {[306, 315].map((y) => (
            <path key={y} d={`M22 ${y} Q100 ${y + 6} 178 ${y}`} fill="none" stroke="#0d1a14" strokeOpacity="0.5" strokeWidth="1.6" />
          ))}
        </g>
      ) : null}
      <path d={FOOT} fill={`url(#${id}-green)`} />
      <path d="M40 258 L160 258" stroke="#0d1a14" strokeOpacity="0.35" strokeWidth="1.5" />
    </g>
  );
}

function CapPart({ id }: { id: string }) {
  return (
    <g>
      <rect x="12" y="300" width="176" height="30" rx="4" fill={`url(#${id}-cap)`} />
      {FLUTES.map((x) => (
        <line key={x} x1={x} x2={x} y1="304" y2="326" stroke="#000" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
      ))}
      <line x1="14" x2="186" y1="300.5" y2="300.5" stroke="#fff" strokeOpacity="0.18" />
    </g>
  );
}

/** Seitenansicht des montierten Stempels. */
export function StampSide({ className, title }: { className?: string; title?: string }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg viewBox="0 0 200 340" className={cn('h-auto w-full', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Defs id={id} />
      <LogoDisc id={id} />
      <HandlePart id={id} />
      <FootPart id={id} />
      <CapPart id={id} />
    </svg>
  );
}

/** Seitenansicht mit Hauptmaßen. */
export function StampDimensions({ className }: { className?: string }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const dim = { stroke: 'var(--subtle)', strokeWidth: 1 } as const;
  const label = { fill: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-sans)', className: 'tabular' } as const;
  return (
    <svg viewBox="-70 -40 380 420" className={cn('h-auto w-full', className)} role="img" aria-label="Maßzeichnung des Stempels: Gesamthöhe 80 Millimeter, Durchmesser am Fuß 44 Millimeter, Knauf 34 Millimeter, Taille 19 Millimeter.">
      <Defs id={id} />
      <line x1="100" x2="100" y1="-12" y2="352" stroke="var(--line-strong)" strokeDasharray="10 4 2 4" />
      <LogoDisc id={id} />
      <HandlePart id={id} />
      <FootPart id={id} />
      <CapPart id={id} />

      {/* Ø 34 Knauf */}
      <g {...dim}>
        <line x1="32" x2="32" y1="4" y2="-26" />
        <line x1="168" x2="168" y1="4" y2="-26" />
        <line x1="32" x2="168" y1="-20" y2="-20" />
        <path d="M32 -20 l7 -3 v6 z M168 -20 l-7 -3 v6 z" fill="var(--subtle)" stroke="none" />
      </g>
      <text x="100" y="-27" textAnchor="middle" {...label}>Ø 34 mm</text>

      {/* Ø 44 Fuß */}
      <g {...dim}>
        <line x1="12" x2="12" y1="336" y2="362" />
        <line x1="188" x2="188" y1="336" y2="362" />
        <line x1="12" x2="188" y1="356" y2="356" />
        <path d="M12 356 l7 -3 v6 z M188 356 l-7 -3 v6 z" fill="var(--subtle)" stroke="none" />
      </g>
      <text x="100" y="374" textAnchor="middle" {...label}>Ø 44 mm</text>

      {/* 80 Gesamthöhe */}
      <g {...dim}>
        <line x1="194" x2="244" y1="10" y2="10" />
        <line x1="194" x2="244" y1="330" y2="330" />
        <line x1="238" x2="238" y1="10" y2="330" />
        <path d="M238 10 l-3 7 h6 z M238 330 l-3 -7 h6 z" fill="var(--subtle)" stroke="none" />
      </g>
      <text x="250" y="174" {...label}>80 mm</text>

      {/* 18 Fuß */}
      <g {...dim}>
        <line x1="6" x2="-30" y1="258" y2="258" />
        <line x1="6" x2="-30" y1="330" y2="330" />
        <line x1="-24" x2="-24" y1="258" y2="330" />
        <path d="M-24 258 l-3 7 h6 z M-24 330 l-3 -7 h6 z" fill="var(--subtle)" stroke="none" />
      </g>
      <text x="-30" y="298" textAnchor="end" {...label}>18 mm</text>

      {/* Ø 19 Taille */}
      <g {...dim}>
        <line x1="56" x2="-8" y1="152" y2="152" />
      </g>
      <circle cx="60" cy="152" r="2.5" fill="var(--subtle)" />
      <text x="-12" y="156" textAnchor="end" {...label}>Ø 19 mm</text>
    </svg>
  );
}

/** Explosionsdarstellung der vier Druckteile samt NFC-Chip. */
export function StampExploded({ className }: { className?: string }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const callouts = [
    { n: 1, y: -34 },
    { n: 2, y: 150 },
    { n: 3, y: 372 },
    { n: 4, y: 468 },
    { n: 5, y: 535 },
  ];
  return (
    <svg
      viewBox="-10 -60 300 640"
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label="Explosionsdarstellung des Stempels von oben nach unten: Logo-Scheibe, Griff mit Gewindezapfen, Fuß mit Gewindehals, NFC-Chip und Abdeckkappe."
    >
      <Defs id={id} />
      <line x1="100" x2="100" y1="-52" y2="566" stroke="var(--line-strong)" strokeDasharray="10 4 2 4" />

      {/* 1 Logo-Scheibe */}
      <g transform="translate(0 -44)">
        <LogoDisc id={id} />
      </g>
      {/* 2 Griff */}
      <HandlePart id={id} stud />
      {/* Aufnahme für die Scheibe */}
      <rect x="54" y="10" width="92" height="5" rx="2" fill="#9c7a48" fillOpacity="0.4" />
      {/* 3 Fuß */}
      <g transform="translate(0 92)">
        <FootPart id={id} neck />
      </g>
      {/* 4 NFC-Chip */}
      <g>
        <ellipse cx="100" cy="468" rx="50" ry="9" fill="#f3e2c2" stroke="#c98a2b" strokeWidth="1.5" />
        <ellipse cx="100" cy="468" rx="40" ry="6.4" fill="none" stroke="#c98a2b" strokeWidth="1.2" />
        <ellipse cx="100" cy="468" rx="32" ry="4.8" fill="none" stroke="#c98a2b" strokeWidth="1.2" />
        <rect x="94" y="465" width="12" height="6" rx="1" fill="#15181b" />
      </g>
      {/* 5 Kappe */}
      <g transform="translate(0 220)">
        <CapPart id={id} />
      </g>

      {callouts.map((c) => (
        <g key={c.n}>
          <line x1={c.n === 1 ? 152 : c.n === 4 ? 154 : c.n === 2 ? 142 : 192} x2="236" y1={c.y} y2={c.y} stroke="var(--subtle)" strokeWidth="1" />
          <circle cx="252" cy={c.y} r="15" fill="var(--surface)" stroke="var(--line-strong)" />
          <text x="252" y={c.y + 5} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-sans)">
            {c.n}
          </text>
        </g>
      ))}
    </svg>
  );
}
