import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { SiteFooter } from '@/components/marketing/site-footer'
import { ServiceWorkerRegister } from '@/components/sw-register'
import { SITE_URL } from '@/lib/site'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
})

const APP_URL = SITE_URL
const DESCRIPTION =
  'VMS V0 is a free, open-source, self-hosted inventory management template: ' +
  'typed storerooms, scan-first barcode/QR/RFID workflows, an append-only ' +
  'ledger, RBAC, stock takes, tool loans, sensor monitoring, and a REST + ' +
  'MCP API. Next.js 16 and Postgres — runs on a laptop or a site server.'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: 'VMS V0',
  title: {
    default: 'VMS V0 — Inventory Management, Open Source',
    template: '%s · VMS V0',
  },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  manifest: '/manifest.json',
  keywords: [
    'inventory management',
    'open source',
    'self-hosted',
    'warehouse',
    'stock control',
    'barcode scanning',
    'RFID',
    'stock take',
    'audit trail',
    'Next.js',
    'Postgres',
  ],
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'VMS V0',
    title: 'VMS V0 — Inventory Management, Open Source',
    description: DESCRIPTION,
    locale: 'en_ZA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VMS V0 — Inventory Management, Open Source',
    description: DESCRIPTION,
  },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#17130f' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} ${plexMono.variable} font-sans`}>
        {children}
        <SiteFooter />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
