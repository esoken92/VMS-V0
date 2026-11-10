'use client';

import { useState } from 'react';
import { Camera, QrCode, Package, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const handleScan = () => {
    setScanning(true);
    // Simulate scan
    setTimeout(() => {
      setScanning(false);
      setLastScan('BRK-001');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-sidebar flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-sidebar-foreground hover:text-sidebar-foreground">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-xl font-bold text-sidebar-foreground">Barcode Scanner</h1>
      </div>

      {/* Scanner Viewfinder */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="relative w-full max-w-sm aspect-square bg-sidebar rounded-2xl overflow-hidden border-4 border-sidebar-border">
          {scanning ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-success/50 rounded-lg animate-pulse"></div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <QrCode className="h-24 w-24 text-sidebar-muted" />
            </div>
          )}

          {/* Corner markers */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-success/50"></div>
          <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-success/50"></div>
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-success/50"></div>
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-success/50"></div>
        </div>

        {/* Last Scan Result */}
        {lastScan && (
          <div className="mt-6 w-full max-w-sm bg-card rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-sidebar-muted">Last Scanned</p>
                <p className="text-lg font-bold text-foreground">{lastScan}</p>
              </div>
            </div>
            <p className="text-sm text-sidebar-muted mt-2">Brake Pad Set - 150 in stock</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-sidebar">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-success text-success-foreground rounded-xl font-medium hover:bg-success/90 disabled:opacity-50 transition-colors"
        >
          <Camera className="h-6 w-6" />
          {scanning ? 'Scanning...' : 'Scan Barcode'}
        </button>
        <p className="text-center text-sm text-sidebar-muted mt-3">
          Point camera at barcode to scan
        </p>
      </div>
    </div>
  );
}
