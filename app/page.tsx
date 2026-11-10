/**
 * Landing page — public marketing surface for the VMS template.
 *
 * Everything lives inside a ThemeScope so the shared design tokens flip
 * between light and dark without touching the dashboard subtree. Sections:
 * nav → hero → features → how-it-works → comparison → screenshots → CTA.
 * The shared footer is rendered by app/layout.tsx below this page.
 */

import Link from 'next/link';
import { ArrowRight, Terminal } from 'lucide-react';
import { GithubIcon } from '@/components/icons/github';
import { ThemeScope } from '@/components/marketing/theme-script';
import { SiteNav } from '@/components/marketing/site-nav';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { LogicChainDiagram } from '@/components/marketing/logic-chain-diagram';
import { ComparisonTable } from '@/components/marketing/comparison-table';
import { ScreenshotGrid } from '@/components/marketing/screenshot-frame';
import { GITHUB_URL } from '@/components/marketing/site-footer';

const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {children && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <ThemeScope
      id="vms-landing"
      className="min-h-screen bg-background text-foreground"
    >
      <SiteNav />

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="container relative py-20 text-center sm:py-28">
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Open source · CC BY-NC-SA 4.0 · Self-hosted
            </a>

            <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Inventory management that respects the people doing the work
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              VMS is a free, open-source inventory template for teams still
              running stock on spreadsheets and paper — typed storerooms,
              scan-first workflows, tool custody, sensor monitoring, and an
              audit trail that never forgets.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
              >
                View demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-8 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-accent sm:w-auto"
              >
                <GithubIcon className="h-5 w-5" aria-hidden="true" />
                Star on GitHub
              </a>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              Runs locally in under 5 minutes — demo credentials are in the{' '}
              <a
                href={`${GITHUB_URL}#demo-credentials`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                README
              </a>
              .
            </p>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section id="features" className="scroll-mt-20 border-t border-border/60 py-20 sm:py-24">
          <div className="container">
            <SectionHeading
              eyebrow="Capabilities"
              title="Everything a real stockroom needs"
            >
              The features below come from a gap analysis of eight mature
              open-source inventory systems and a catalogue of real operator
              complaints — not from a feature checklist written in a vacuum.
            </SectionHeading>
            <div className="mt-14">
              <FeatureGrid />
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-20 sm:py-24"
        >
          <div className="container">
            <SectionHeading
              eyebrow="How it works"
              title="Every request walks the same chain"
            >
              There is exactly one path from a scan or a click to a recorded
              change. Nothing reaches the database without passing every gate —
              and denied attempts are logged too.
            </SectionHeading>
            <div className="mt-14 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10">
              <LogicChainDiagram />
            </div>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
              Read the full walkthrough in{' '}
              <a
                href={`${GITHUB_URL}/blob/main/docs/LOGIC_CHAIN.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                docs/LOGIC_CHAIN.md
              </a>
              .
            </p>
          </div>
        </section>

        {/* ── Comparison ───────────────────────────────────────── */}
        <section id="compare" className="scroll-mt-20 border-t border-border/60 py-20 sm:py-24">
          <div className="container">
            <SectionHeading
              eyebrow="The incumbent"
              title="Spreadsheets and paper are the competition"
            >
              Most small operations don’t choose between inventory systems —
              they choose between a system and a spreadsheet. Here is what the
              research says that choice costs.
            </SectionHeading>
            <div className="mx-auto mt-14 max-w-5xl">
              <ComparisonTable />
              <p className="mt-4 text-xs text-muted-foreground">
                Sources: competitive research in{' '}
                <a
                  href={`${GITHUB_URL}/blob/main/docs/research/02-customer-complaints.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  docs/research
                </a>{' '}
                — spreadsheet-error audits, WERC DC metrics, and operator
                complaint analysis across eight inventory platforms.
              </p>
            </div>
          </div>
        </section>

        {/* ── Screenshots ──────────────────────────────────────── */}
        <section
          id="screenshots"
          className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-20 sm:py-24"
        >
          <div className="container">
            <SectionHeading
              eyebrow="The product"
              title="Built for the floor, not the boardroom"
            >
              Mobile-first and glove-friendly. These are real captures of
              the app you run — no mockups.
            </SectionHeading>
            <div className="mt-14">
              <ScreenshotGrid />
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="border-t border-border/60 py-20 sm:py-24">
          <div className="container">
            <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm sm:p-12">
              <h2 className="text-3xl font-bold tracking-tight">
                Run it on your laptop in 5 minutes
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                One Next.js app with an embedded Postgres — zero external
                services required. Fork it, brand it, and make it yours.
              </p>
              <div className="mx-auto mt-8 flex max-w-xl items-center gap-3 overflow-x-auto rounded-lg bg-muted px-4 py-3 text-left">
                <Terminal
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <code className="whitespace-nowrap text-sm">
                  npm install &amp;&amp; npm run dev:standalone
                </code>
              </div>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
                >
                  <GithubIcon className="h-5 w-5" aria-hidden="true" />
                  Get the code
                </a>
                <Link
                  href="/dashboard"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-8 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-accent sm:w-auto"
                >
                  Try the demo first
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </ThemeScope>
  );
}
