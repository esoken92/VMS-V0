/**
 * SiteNav — landing-page header. Sticky, translucent, section anchors on
 * the left; GitHub + app CTA on the right. Section links collapse on
 * small screens (the page below still carries every anchor).
 */

import Link from 'next/link';
import { Star } from 'lucide-react';
import { GithubIcon } from '@/components/icons/github';
import { ThemeToggle } from './theme-toggle';
import { GITHUB_URL } from './site-footer';

const anchors = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Why not spreadsheets', href: '#compare' },
  { label: 'Screenshots', href: '#screenshots' },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label="VMS home">
          <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#1d4ed8" />
            <path
              d="M14 26 32 16l18 10v22a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2Z"
              fill="#fff"
              opacity=".92"
            />
            <path
              d="M20 30v16M28 30v16M36 30v16M44 30v16"
              stroke="#1d4ed8"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M14 26h36"
              stroke="#bfdbfe"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-lg font-bold tracking-tight">VMS</span>
          <span className="hidden rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground sm:inline">
            open source
          </span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-6 lg:flex">
          {anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {a.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <GithubIcon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Star on GitHub</span>
            <Star className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline" aria-hidden="true" />
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}
