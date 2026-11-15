import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });

const siteUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Tapperl – Digitale Treuekarten mit NFC-Stempel', template: '%s · Tapperl' },
  description: 'Tap. Stamp. Reward. Digitale Kundenkarten für Cafés, Salons und Läden – gestempelt mit einem echten NFC-Stempel statt QR-Scanner.',
  openGraph: { type: 'website', locale: 'de_DE', siteName: 'Tapperl' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f8f7f3' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
