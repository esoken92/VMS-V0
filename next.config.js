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
    // The Typst compiler ships a native .node addon — external too, so the
    // platform-matched binary is required at runtime, not bundled.
    serverComponentsExternalPackages: [
      '@electric-sql/pglite',
      '@electric-sql/pglite-socket',
      '@myriaddreamin/typst-ts-node-compiler',
    ],
    // Ship the externalized native addon + the Inter TTFs (read per-file in
    // lib/pdf/compiler.ts) into every traced function that can compile a PDF.
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/@myriaddreamin/**',
        './lib/pdf/fonts/**',
      ],
    },
  },
};

module.exports = withPWA(nextConfig);
