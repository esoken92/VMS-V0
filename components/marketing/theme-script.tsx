/**
 * ThemeScope / ThemeScript — scoped dark-mode support for the marketing
 * surface.
 *
 * The repo uses Tailwind's `class` dark-mode strategy. Rather than toggling
 * `.dark` on <html> (which would flip semantic color tokens on app pages
 * that were not designed for them), the class is applied to a wrapper
 * element identified by `id`. Semantic tokens (bg-background, text-foreground,
 * fill-primary, …) resolve through CSS variables, so everything inside the
 * wrapper follows the theme and everything outside is untouched.
 *
 * Two application paths cover both render lifecycles:
 *  - `ThemeScript` is an inline <script> that runs during HTML parse —
 *    before first paint — on full page loads (no theme flash).
 *  - `ThemeScope` is a client component whose mount effect applies the
 *    class on client-side navigations, where React re-creates the wrapper
 *    but inline scripts never re-execute.
 *
 * Theme choice: explicit user choice in localStorage (`vms-theme`:
 * "dark" | "light") wins; otherwise `prefers-color-scheme`, tracked live.
 * A future theme toggle only needs to write `vms-theme` and dispatch a
 * `vms-theme-change` event — every scope listens for it.
 *
 * Elements whose class is mutated carry `suppressHydrationWarning` —
 * React never owns that attribute after boot.
 */

'use client';

import { useEffect, useLayoutEffect } from 'react';

// Layout effect on the client (applies theme before paint, no flash);
// plain effect when SSR-rendering the client component.
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

const THEME_STORAGE_KEY = 'vms-theme';
const THEME_EVENT = 'vms-theme-change';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function resolveDark(): boolean {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch {
    // localStorage unavailable (private mode, old browsers) — fall through
  }
  return window.matchMedia(DARK_QUERY).matches;
}

function applyTheme(el: HTMLElement | null) {
  if (!el) return;
  const dark = resolveDark();
  el.classList.toggle('dark', dark);
  el.style.colorScheme = dark ? 'dark' : 'light';
}

/**
 * Script source shared by the inline <script> below. Kept tiny — it is
 * inlined into the HTML payload verbatim. Must stay in sync with the
 * client-side logic above (same storage key, same query).
 */
function themeScriptFor(targetId: string): string {
  return (
    '(function(){try{' +
    `var k='${THEME_STORAGE_KEY}',id='${targetId}';` +
    `var m=window.matchMedia('${DARK_QUERY}');` +
    'function apply(){var e=document.getElementById(id);if(!e)return;' +
    'var t=null;try{t=localStorage.getItem(k)}catch(_){ }' +
    "var d=t==='dark'||(t!=='light'&&m.matches);" +
    "e.classList.toggle('dark',d);" +
    "e.style.colorScheme=d?'dark':'light';}" +
    'apply();' +
    'var h=function(){if(localStorage.getItem(k))return;apply()};' +
    "if(m.addEventListener){m.addEventListener('change',h)}" +
    'else if(m.addListener){m.addListener(h)}' +
    `window.addEventListener('${THEME_EVENT}',apply);` +
    '}catch(e){}})()'
  );
}

/**
 * Inline script for SSR/full page loads. Render it as the first child of
 * the target element (or inside it) so the element already exists when
 * the script executes.
 */
export function ThemeScript({ targetId }: { targetId: string }) {
  return <script dangerouslySetInnerHTML={{ __html: themeScriptFor(targetId) }} />;
}

/**
 * Wrapper that scopes `.dark` to a subtree. The inline script handles the
 * SSR path; the mount effect handles client-side navigations and keeps
 * listening for OS-level theme changes while the page is open.
 */
export function ThemeScope({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  useIsomorphicLayoutEffect(() => {
    const el = document.getElementById(id);
    applyTheme(el);

    const media = window.matchMedia(DARK_QUERY);
    const onMediaChange = () => {
      try {
        if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
      } catch {
        /* fall through */
      }
      applyTheme(el);
    };
    const onExplicitChange = () => applyTheme(el);

    if (media.addEventListener) {
      media.addEventListener('change', onMediaChange);
    } else {
      // Safari < 14
      media.addListener(onMediaChange);
    }
    window.addEventListener(THEME_EVENT, onExplicitChange);

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', onMediaChange);
      } else {
        media.removeListener(onMediaChange);
      }
      window.removeEventListener(THEME_EVENT, onExplicitChange);
    };
  }, [id]);

  return (
    <div id={id} className={className} suppressHydrationWarning>
      <ThemeScript targetId={id} />
      {children}
    </div>
  );
}
