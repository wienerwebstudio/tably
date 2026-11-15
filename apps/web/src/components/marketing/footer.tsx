import Link from 'next/link';
import { Logo } from '@tably/ui';
import { LOGIN_URL } from './site';

const groups = [
  {
    title: 'Produkt',
    links: [
      { href: '/funktionen', label: 'Funktionen' },
      { href: '/branchen', label: 'Branchen' },
      { href: '/hardware', label: 'Der Stempel' },
      { href: '/preise', label: 'Preise' },
    ],
  },
  {
    title: 'Hilfe',
    links: [
      { href: '/faq', label: 'Häufige Fragen' },
      { href: '/kontakt', label: 'Kontakt' },
      { href: '/karten', label: 'Meine Karten' },
      { href: LOGIN_URL, label: 'Anmelden', external: true },
    ],
  },
  {
    title: 'Rechtliches',
    links: [
      { href: '/impressum', label: 'Impressum' },
      { href: '/datenschutz', label: 'Datenschutz' },
      { href: '/agb', label: 'AGB' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
          <div>
            <Link href="/" aria-label="Tably – zur Startseite" className="inline-block rounded-lg">
              <Logo className="text-[17px]" />
            </Link>
            <p className="mt-5 font-display text-2xl leading-snug text-ink">Tap. Stamp. Reward.</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">Digitale Treuekarten für Cafés, Salons und Läden – gestempelt mit einem echten NFC-Stempel.</p>
          </div>
          <nav aria-label="Fußzeile" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">{group.title}</h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {'external' in link ? (
                        <a href={link.href} className="text-[15px] text-muted transition-colors hover:text-ink">
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} prefetch={false} className="text-[15px] text-muted transition-colors hover:text-ink">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Tably</p>
          <p>Diese Website setzt keine Tracking-Cookies und bindet keine Analysedienste Dritter ein.</p>
        </div>
      </div>
    </footer>
  );
}
