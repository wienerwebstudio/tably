'use client';
import * as React from 'react';
import { cn } from '@tapperl/ui';

/**
 * Dezentes Einblenden beim Scrollen. Ohne JavaScript und bei reduzierter
 * Bewegung bleibt der Inhalt einfach sichtbar: versteckt wird erst nach dem
 * Mounten und nur, was noch unterhalb des sichtbaren Bereichs liegt.
 */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<'static' | 'hidden' | 'shown'>('static');

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setState('hidden');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState('shown');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(state !== 'static' && 'transition-[opacity,transform] duration-700 ease-out', state === 'hidden' && 'translate-y-3 opacity-0', className)}
      style={state === 'shown' && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
