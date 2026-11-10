const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest.json$/]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Local uploads are served from /api/uploads — no remote hosts needed.
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Keep the embedded-Postgres WASM build out of the server bundle —
    // resolved from node_modules at runtime, and only when DATABASE_URL is
    // unset (see lib/db/driver.ts). pglite-socket serves the embedded db to
    // the other dev render workers over localhost.
    serverComponentsExternalPackages: [
      '@electric-sql/pglite',
      '@electric-sql/pglite-socket',
    ],
  },
};

module.exports = withPWA(nextConfig);
