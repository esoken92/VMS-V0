/**
 * Root Layout Component
 * Configures global styles, metadata, providers, and PWA registration
 */

import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import PWAProvider from '@/components/providers/PWAProvider';
import SyncProvider from '@/components/providers/SyncProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Warehouse IMS - Heavy-Duty Truck Parts Inventory',
  description:
    'Enterprise inventory management system for warehouse operations with offline support',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Warehouse IMS',
  },
  formatDetection: {
    telephone: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Warehouse IMS" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Warehouse IMS" />
        <meta name="theme-color" content="#ffffff" />

        {/* iOS Icons */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icon-180x180.png"
        />

        {/* Android Chrome Icons */}
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/icon-192x192.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="512x512"
          href="/icon-512x512.png"
        />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Preconnect to Supabase */}
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL}
          crossOrigin="anonymous"
        />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js').then(
                  (registration) => {
                    console.log('Service Worker registered:', registration);
                  }
                ).catch((error) => {
                  console.log('Service Worker registration failed:', error);
                });
              });
            }
          `,
          }}
        />
      </head>

      <body className={`${inter.className} h-full bg-gray-50`}>
        <AuthProvider>
          <PWAProvider>
            <SyncProvider>
              <div id="root" className="min-h-screen flex flex-col">
                {children}
              </div>
            </SyncProvider>
          </PWAProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
