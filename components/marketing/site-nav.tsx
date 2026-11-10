/**
 * SiteNav — landing-page header. Sticky, translucent, section anchors on
 * the left; GitHub + demo CTA on the right. Section links collapse on
 * small screens (the page below still carries every anchor).
 */

import Link from 'next/link';
import { Star } from 'lucide-react';
import { GithubIcon } from '@/components/icons/github';
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
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
          >
            V
          </span>
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
            View demo
          </Link>
        </div>
      </div>
    </header>
  );
}
