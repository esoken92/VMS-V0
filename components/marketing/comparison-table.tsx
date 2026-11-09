/**
 * ComparisonTable — "VMS vs spreadsheets & paper", grounded in the repo's
 * competitive research (docs/research/02-customer-complaints.md). The stats
 * are real findings, not invented marketing claims.
 */

import { Check, X } from 'lucide-react';

interface Row {
  capability: string;
  incumbent: string;
  vms: string;
}

const ROWS: Row[] = [
  {
    capability: 'Data-entry accuracy',
    incumbent: '~94% of audited spreadsheets contain errors — typos, duplicates, broken formulas',
    vms: 'Validated forms and scan-first entry — the scan is the record',
  },
  {
    capability: 'Audit trail',
    incumbent: 'None — who changed what, and when, is lost forever',
    vms: 'Append-only ledger attributes every change to a person and a second',
  },
  {
    capability: 'Reorder alerts',
    incumbent: 'Reorders run on memory; nobody is alerted at the threshold',
    vms: 'Min/max thresholds flag low stock everywhere it matters',
  },
  {
    capability: 'Shrinkage',
    incumbent: 'Invisible — paper records what you write down, never what it doesn’t see',
    vms: 'Variance is surfaced at every count and trended over time',
  },
  {
    capability: 'Physical counts',
    incumbent: 'Full counts stop the operation; month-end never quite reconciles',
    vms: 'Blind stock takes and cycle counts run while work continues',
  },
  {
    capability: 'Source of truth',
    incumbent: 'Two people, two versions — the clipboard is the only copy',
    vms: 'One Postgres database, one truth, visible to every permitted role',
  },
  {
    capability: 'Price',
    incumbent: '“Free” — until the errors compound',
    vms: 'Free and open-source. Self-hosted, so your data stays yours',
  },
];

export function ComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">
          Comparison between managing inventory on spreadsheets and paper
          versus VMS
        </caption>
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th scope="col" className="px-5 py-4 font-semibold">
              The job to be done
            </th>
            <th scope="col" className="px-5 py-4 font-semibold">
              Spreadsheets &amp; paper
            </th>
            <th scope="col" className="px-5 py-4 font-semibold">
              VMS
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr
              key={row.capability}
              className="border-b border-border last:border-0"
            >
              <th
                scope="row"
                className="px-5 py-4 align-top font-medium text-foreground"
              >
                {row.capability}
              </th>
              <td className="px-5 py-4 align-top text-muted-foreground">
                <span className="flex gap-2">
                  <X
                    className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <span>{row.incumbent}</span>
                </span>
              </td>
              <td className="px-5 py-4 align-top">
                <span className="flex gap-2">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{row.vms}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
