import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { SiteFooter } from '@/components/marketing/site-footer'
import { ServiceWorkerRegister } from '@/components/sw-register'

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const DESCRIPTION =
  'VMS is a free, open-source, self-hosted inventory management template: ' +
  'typed storerooms, scan-first barcode/QR/RFID workflows, an append-only ' +
  'ledger, RBAC, stock takes, tool loans, sensor monitoring, and a REST + ' +
  'MCP API. Next.js 16 and Postgres — runs on a laptop or a site server.'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  applicationName: 'VMS',
  title: {
    default: 'VMS — Inventory Management, Open Source',
    template: '%s · VMS',
  },
  description: DESCRIPTION,
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
    siteName: 'VMS',
    title: 'VMS — Inventory Management, Open Source',
    description: DESCRIPTION,
    locale: 'en_ZA',
  },
  twitter: {
    card: 'summary',
    title: 'VMS — Inventory Management, Open Source',
    description: DESCRIPTION,
  },
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
