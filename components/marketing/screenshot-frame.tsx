/**
 * ScreenshotFrame — styled placeholders for product screenshots. Real
 * captures (docs/screenshots/) drop in later by replacing the inner block
 * with a next/image; the chrome and captions stay.
 */

import { LayoutDashboard, ScanLine, ClipboardList, type LucideIcon } from 'lucide-react';

interface Shot {
  icon: LucideIcon;
  title: string;
  url: string;
  caption: string;
}

const SHOTS: Shot[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    url: 'vms.local/dashboard',
    caption:
      'Stat cards, low-stock alerts, and the live activity feed — every number deep-links to the screen where you act.',
  },
  {
    icon: ScanLine,
    title: 'Scan-first receiving',
    url: 'vms.local/scan',
    caption:
      'Camera, wedge scanner, or RFID — one scan is one action. Unknown barcodes offer to create the product.',
  },
  {
    icon: ClipboardList,
    title: 'Blind stock take',
    url: 'vms.local/dashboard/stock-takes',
    caption:
      'Count what is physically there without seeing system quantities; variance posts only after review.',
  },
];

function BrowserChrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-4 py-2.5">
      <span className="flex gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
      </span>
      <span className="flex-1 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
        {url}
      </span>
    </div>
  );
}

export function ScreenshotGrid() {
  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {SHOTS.map((shot) => (
        <li key={shot.title}>
          <figure>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <BrowserChrome url={shot.url} />
              <div
                className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-muted/30 p-6 text-center"
                role="img"
                aria-label={`${shot.title} screenshot placeholder`}
              >
                <shot.icon
                  className="h-10 w-10 text-muted-foreground/50"
                  aria-hidden="true"
                />
                <span className="rounded-full border border-dashed border-muted-foreground/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                  Screenshot coming soon
                </span>
              </div>
            </div>
            <figcaption className="mt-3">
              <p className="text-sm font-semibold">{shot.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{shot.caption}</p>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
