'use client';

/**
 * useHidWedge — captures keyboard-wedge scanner input.
 *
 * HID scanners emulate a keyboard: a burst of characters at machine speed
 * (typically <30 ms apart) terminated by Enter. Human typing is slower and
 * lands in form fields — so we only build a buffer when keystrokes arrive
 * outside inputs/textareas at wedge cadence, and Enter with a plausible
 * buffer length commits the scan.
 *
 * Also used by USB-RFID readers (same burst+Enter signature) — the caller
 * decides the input_type label it reports.
 */

import { useEffect, useRef } from 'react';

/** Max gap between burst keys before the buffer is discarded. */
const INTERKEY_RESET_MS = 120;
/** Safety flush — a stalled buffer never survives to the next scan. */
const STALE_FLUSH_MS = 400;
/** Minimum payload length to accept as a scan (avoids stray key commits). */
const MIN_CODE_LENGTH = 4;

function isFormTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
}

export function useHidWedge(
  onScan: (code: string) => void,
  enabled: boolean,
): void {
  // Latest callback without re-binding the listener every render.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!enabled) return;

    let buffer = '';
    let lastKeyAt = 0;
    let staleTimer: number | undefined;

    const reset = () => {
      buffer = '';
      if (staleTimer !== undefined) window.clearTimeout(staleTimer);
      staleTimer = undefined;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isFormTarget(e.target)) {
        reset();
        return;
      }

      const now = performance.now();

      if (e.key === 'Enter') {
        if (buffer.length >= MIN_CODE_LENGTH && now - lastKeyAt < STALE_FLUSH_MS) {
          e.preventDefault();
          const code = buffer;
          reset();
          onScanRef.current(code);
          return;
        }
        reset();
        return;
      }

      // Only printable single characters feed the buffer.
      if (e.key.length !== 1) return;

      if (now - lastKeyAt > INTERKEY_RESET_MS) buffer = '';
      buffer += e.key;
      lastKeyAt = now;

      if (staleTimer !== undefined) window.clearTimeout(staleTimer);
      staleTimer = window.setTimeout(reset, STALE_FLUSH_MS);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      reset();
    };
  }, [enabled]);
}
