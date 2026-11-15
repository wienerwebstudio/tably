import path from 'node:path';
import type { NextConfig } from 'next';

const apiUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  output: 'standalone',
  // Monorepo: Abhängigkeiten aus dem Workspace-Wurzelverzeichnis mit einsammeln
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@tably/ui'],
  poweredByHeader: false,
  // Die API wird same-origin unter /api erreichbar gemacht: Cookies bleiben
  // First-Party und es ist kein CORS nötig.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
