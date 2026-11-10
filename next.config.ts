import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the dev-tools badge — it only exists in dev and would leak into
  // screenshots/docs; errors still surface in the terminal and overlay.
  devIndicators: false,
  images: {
    // Local uploads are served from /api/uploads — no remote hosts needed.
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Keep the embedded-Postgres WASM build out of the server bundle —
  // resolved from node_modules at runtime, and only when DATABASE_URL is
  // unset (see lib/db/driver.ts). pglite-socket serves the embedded db to
  // the other dev render workers over localhost.
  // The Typst compiler ships a native .node addon — external too, so the
  // platform-matched binary is required at runtime, not bundled.
  serverExternalPackages: [
    '@electric-sql/pglite',
    '@electric-sql/pglite-socket',
    '@myriaddreamin/typst-ts-node-compiler',
  ],
  // Ship the externalized native addon + the IBM Plex TTFs (read per-file
  // in lib/pdf/compiler.ts) into every traced function that can compile a
  // PDF.
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/@myriaddreamin/**', './lib/pdf/fonts/**'],
  },
}

export default nextConfig
