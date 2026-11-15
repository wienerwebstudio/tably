import { SiteFooter } from '@/components/marketing/footer';
import { SiteHeader } from '@/components/marketing/header';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-on-brand"
      >
        Zum Inhalt springen
      </a>
      <SiteHeader />
      <main id="inhalt" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
