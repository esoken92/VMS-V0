/**
 * ThemeToggle — light/dark switch for the marketing surface.
 *
 * Writes `vms-theme` and dispatches `vms-theme-change` — every ThemeScope
 * listens for the event and applies `.dark` to its wrapper (see
 * theme-script.tsx). Choice persists across visits; "system" is the
 * implicit state until the user picks once.
 */

'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_STORAGE_KEY = 'vms-theme';
const THEME_EVENT = 'vms-theme-change';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function ThemeToggle() {
  // null until mounted — the icon depends on client-only state, so SSR
  // renders a stable placeholder to avoid hydration mismatch.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const resolve = () => {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark') return true;
        if (stored === 'light') return false;
      } catch {
        /* fall through */
      }
      return window.matchMedia(DARK_QUERY).matches;
    };
    setDark(resolve());
  }, []);

  const toggle = () => {
    const next = !dark;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      /* private mode — still apply for this session */
    }
    setDark(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {dark === null ? (
        <Sun className="h-4 w-4 opacity-0" aria-hidden="true" />
      ) : dark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
