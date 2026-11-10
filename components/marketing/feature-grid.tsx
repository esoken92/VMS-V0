/**
 * FeatureGrid — the ten headline capabilities, sourced from the product
 * spec. Icons are lucide-react (already a dependency); styling uses the
 * shared semantic tokens so cards follow the theme.
 */

import {
  Warehouse,
  ScanLine,
  ScrollText,
  ShieldCheck,
  ClipboardCheck,
  Wrench,
  Thermometer,
  Plug,
  WifiOff,
  Server,
  type LucideIcon,
} from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Warehouse,
    title: 'Storerooms by type',
    description:
      'Cold rooms, dry stores, secure cages, vehicle bays, hazmat cabinets — each with its own rules, item allowlists, and access levels.',
  },
  {
    icon: ScanLine,
    title: 'Scan-first workflows',
    description:
      'Barcode, QR, and RFID via camera, USB/Bluetooth wedge, or RFID reader. One scan is one action — no forms in the way.',
  },
  {
    icon: ScrollText,
    title: 'Append-only ledger',
    description:
      'Every quantity change is a new ledger row — actor, reason, before and after. Corrections are entries, never edits.',
  },
  {
    icon: ShieldCheck,
    title: 'RBAC personas',
    description:
      'Role-shaped permissions checked on the server — super_admin, admin, manager, dispatch, staff — never trusted from the client.',
  },
  {
    icon: ClipboardCheck,
    title: 'Stock takes',
    description:
      'Blind counts that don’t reveal system quantities, variance review before posting, and scheduled cycle counts.',
  },
  {
    icon: Wrench,
    title: 'Tool loans',
    description:
      'Check-out/check-in with condition logging, expected-return dates, and overdue tracking — custody is always clear.',
  },
  {
    icon: Thermometer,
    title: 'Sensor monitoring',
    description:
      'Temperature, humidity, and door telemetry per room with threshold rules, excursion alerts, and a demo simulator.',
  },
  {
    icon: Plug,
    title: 'REST API + MCP',
    description:
      'A versioned REST API with scoped keys, plus an MCP server so agents and assistants can query stock safely.',
  },
  {
    icon: WifiOff,
    title: 'Installable PWA',
    description:
      'Manifest and service worker included — add to a device home screen and it behaves like an app. Queued offline writes are on the roadmap.',
  },
  {
    icon: Server,
    title: 'Self-hosted',
    description:
      'Postgres in Docker, Next.js app server, no telemetry, no per-seat fees. Runs on a laptop or a site server.',
  },
];

export function FeatureGrid() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
      {FEATURES.map((feature) => (
        <li
          key={feature.title}
          className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <div
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <feature.icon className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {feature.description}
          </p>
        </li>
      ))}
    </ul>
  );
}
