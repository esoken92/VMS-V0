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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-white hover:text-gray-300">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-xl font-bold text-white">Barcode Scanner</h1>
      </div>

      {/* Scanner Viewfinder */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="relative w-full max-w-sm aspect-square bg-black rounded-2xl overflow-hidden border-4 border-gray-700">
          {scanning ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-green-400 rounded-lg animate-pulse"></div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <QrCode className="h-24 w-24 text-gray-600" />
            </div>
          )}

          {/* Corner markers */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-green-400"></div>
          <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-green-400"></div>
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-green-400"></div>
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-green-400"></div>
        </div>

        {/* Last Scan Result */}
        {lastScan && (
          <div className="mt-6 w-full max-w-sm bg-white rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Scanned</p>
                <p className="text-lg font-bold text-gray-900">{lastScan}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Brake Pad Set - 150 in stock</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-gray-800">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:bg-gray-600 transition-colors"
        >
          <Camera className="h-6 w-6" />
          {scanning ? 'Scanning...' : 'Scan Barcode'}
        </button>
        <p className="text-center text-sm text-gray-400 mt-3">
          Point camera at barcode to scan
        </p>
      </div>
    </div>
  );
}
