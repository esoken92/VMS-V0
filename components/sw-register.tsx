'use client';

import { useEffect } from 'react';

/** Registers the handwritten /sw.js in production only (see public/sw.js). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is best-effort — never surface a registration failure.
    });
  }, []);
  return null;
}
