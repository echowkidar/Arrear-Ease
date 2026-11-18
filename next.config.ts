import type {NextConfig} from 'next';
import withSerwistInit from '@serwist/next';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

// PWA service worker: built from src/sw.ts into public/sw.js on production builds only.
const PRECACHE_EXT = /\.(?:js|css|html|svg|png|woff2|ico)$/;
// Public files to precache: app icons only. public/vendor (OpenCV, ~10 MB) is loaded lazily, never precached.
const PUBLIC_SHELL = ['favicon.ico', 'icons/logo.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const fileRevision = (f: string) => createHash('md5').update(readFileSync(`public/${f}`)).digest('hex');
const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  register: false, // registered by src/components/pwa-shell.tsx in production
  disable: process.env.NODE_ENV !== 'production',
  cacheOnNavigation: false,
  reloadOnOnline: false,
  additionalPrecacheEntries: [
    { url: '/~offline', revision: randomUUID() },
    ...PUBLIC_SHELL.map((f) => ({ url: `/${f}`, revision: fileRevision(f) })),
  ],
  // Chunks larger than this are skipped and lazy-loaded from the network instead.
  maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
  manifestTransforms: [
    async (entries) => ({
      // Keep app-shell file types only; drop the empty client stubs Next emits for API route handlers.
      manifest: entries.filter((e) => e.url === '/~offline' || (PRECACHE_EXT.test(e.url.split('?')[0]) && !e.url.includes('/app/api/'))),
      warnings: [],
    }),
  ],
});

const nextConfig: NextConfig = {
  output: 'standalone',
  /* config options here */
  typescript: {
    // Type errors now fail the build so bugs are caught before deploy.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // OpenCV.js for the document scanner: versioned file name, cache for a year
        source: '/vendor/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Service worker must always be revalidated so updates are picked up promptly
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
