'use client';

/**
 * CameraScanner — html5-qrcode wrapper (v2.3.8 API).
 *
 * Defensive by design: html5-qrcode is imported dynamically inside the
 * effect (it touches `window` at module scope on some builds), camera
 * failures surface as a readable error string, and duplicate decodes of
 * the same code inside DEDUPE_MS are swallowed so one pass over a label
 * doesn't fire a burst of scans.
 */

import { useEffect, useRef, useState } from 'react';
import { CameraOff } from 'lucide-react';
import type { Html5Qrcode } from 'html5-qrcode';

const DEDUPE_MS = 2000;
const REGION_ID = 'scan-camera-region';

export function CameraScanner({
  active,
  onScan,
  onError,
}: {
  active: boolean;
  onScan: (decodedText: string) => void;
  onError: (message: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastDecode = useRef<{ code: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const stop = async () => {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        try {
          if (s.isScanning) await s.stop();
        } catch {
          /* teardown races are harmless */
        }
        try {
          s.clear();
        } catch {
          /* noop */
        }
      }
      if (!cancelled) setRunning(false);
    };

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(
                Math.min(viewfinderWidth, viewfinderHeight) * 0.7,
              );
              return { width: edge, height: edge };
            },
          },
          (decodedText) => {
            const now = Date.now();
            const last = lastDecode.current;
            if (last && last.code === decodedText && now - last.at < DEDUPE_MS) {
              return; // same label still in frame
            }
            lastDecode.current = { code: decodedText, at: now };
            onScanRef.current(decodedText);
          },
          () => {
            /* per-frame decode misses are routine — ignore */
          },
        );
        if (!cancelled) setRunning(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Camera unavailable';
        onErrorRef.current(
          /Permission|NotAllowed/i.test(message)
            ? 'Camera permission denied — check browser settings'
            : `Camera error: ${message}`,
        );
      }
    })();

    return () => {
      cancelled = true;
      void stop();
    };
  }, [active]);

  return (
    <div className="relative w-full aspect-square max-h-[52vh] bg-black rounded-2xl overflow-hidden">
      <div id={REGION_ID} className="absolute inset-0" />
      {!running && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
          <CameraOff className="h-12 w-12" />
          <p className="text-sm">Starting camera…</p>
        </div>
      )}
      {/* corner markers */}
      <div className="pointer-events-none absolute top-4 left-4 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
      <div className="pointer-events-none absolute top-4 right-4 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
      <div className="pointer-events-none absolute bottom-4 left-4 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
      <div className="pointer-events-none absolute bottom-4 right-4 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
    </div>
  );
}
