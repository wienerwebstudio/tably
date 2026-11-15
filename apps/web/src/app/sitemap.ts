import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/funktionen', '/branchen', '/hardware', '/preise', '/faq', '/kontakt', '/impressum', '/datenschutz', '/agb'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
