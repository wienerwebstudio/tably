'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { buttonClass, cn, Logo } from '@tably/ui';
import { LOGIN_URL, NAV, REGISTER_URL } from './site';

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => mq.matches && setOpen(false);
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onChange);
    };
  }, [open]);

  return (
    <header className={cn('sticky top-0 z-40 border-b bg-paper/85 backdrop-blur-md transition-colors', scrolled || open ? 'border-line' : 'border-transparent')}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Tably – zur Startseite" className="-ml-1 rounded-lg p-1">
          <Logo className="text-[17px]" />
        </Link>

        <nav aria-label="Hauptnavigation" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn('rounded-lg px-3 py-2 text-[15px] font-medium transition-colors', active ? 'text-ink' : 'text-muted hover:text-ink')}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:block">
            <a href={LOGIN_URL} className={buttonClass({ variant: 'ghost' })}>
              Anmelden
            </a>
          </span>
          <span className="hidden min-[380px]:block">
            <a href={REGISTER_URL} className={buttonClass()}>
              Kostenlos testen
            </a>
          </span>
          <button
            ref={toggleRef}
            type="button"
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-ink hover:bg-sunken lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menue"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="sr-only">{open ? 'Menü schließen' : 'Menü öffnen'}</span>
            {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
          </button>
        </div>
      </div>

      <div id="mobile-menue" hidden={!open} className="border-t border-line bg-paper lg:hidden">
        <nav aria-label="Mobile Navigation" className="mx-auto max-w-6xl px-5 pb-6 pt-2 sm:px-8">
          <ul>
            {NAV.map((item) => (
              <li key={item.href} className="border-b border-line">
                <Link href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className="flex items-center justify-between py-4 font-display text-2xl text-ink" onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="border-b border-line">
              <Link href="/kontakt" className="flex py-4 font-display text-2xl text-ink" onClick={() => setOpen(false)}>
                Kontakt
              </Link>
            </li>
          </ul>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <a href={LOGIN_URL} className={buttonClass({ variant: 'outline', size: 'lg' })}>
              Anmelden
            </a>
            <a href={REGISTER_URL} className={buttonClass({ size: 'lg' })}>
              Kostenlos testen
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
