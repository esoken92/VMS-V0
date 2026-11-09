import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SiteFooter } from '@/components/marketing/site-footer'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const DESCRIPTION =
  'VMS is a free, open-source, self-hosted inventory management template: ' +
  'typed storerooms, scan-first barcode/QR/RFID workflows, an append-only ' +
  'ledger, RBAC, stock takes, tool loans, sensor monitoring, and a REST + ' +
  'MCP API. Next.js 14 and Postgres — runs on a laptop or a site server.'

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
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020817' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
