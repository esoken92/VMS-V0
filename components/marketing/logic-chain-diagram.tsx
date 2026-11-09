/**
 * LogicChainDiagram — the "how it works" request lifecycle, rendered as an
 * inline SVG (no binary assets). Every request to VMS walks the same chain:
 *
 *   request → middleware → auth gate → permission check
 *           → transaction → audit log → UI
 *
 * Colors use the shared semantic tokens (fill-card, stroke-border, …) so the
 * diagram follows light/dark automatically inside a ThemeScope. A vertical
 * ordered list provides the same content on small screens and to assistive
 * tech that prefers linear reading.
 */

const STEPS = [
  {
    title: 'Request',
    lines: ['browser, scanner', 'or API client'],
    note: 'Every action starts as an HTTP request — a page load, a scan, a form post, or an API call.',
  },
  {
    title: 'Middleware',
    lines: ['edge route gate', 'public vs protected'],
    note: 'Edge middleware decides whether the route is public and attaches the session context.',
  },
  {
    title: 'Auth gate',
    lines: ['Auth.js session', 'credentials · argon2id'],
    note: 'Auth.js verifies the session. No valid session, no further progress — ever.',
  },
  {
    title: 'Permission check',
    lines: ['role × action × scope', 'checked server-side'],
    note: 'The app-layer permission matrix checks who you are against what you are trying to do.',
  },
  {
    title: 'Transaction',
    lines: ['Postgres TX', 'validated mutation'],
    note: 'The mutation runs inside a database transaction with Zod-validated input — all or nothing.',
  },
  {
    title: 'Audit log',
    lines: ['append-only entry', 'who · what · when'],
    note: 'Every committed change writes an immutable ledger row. History is never edited or deleted.',
  },
  {
    title: 'UI',
    lines: ['fresh data', 're-rendered'],
    note: 'The interface re-renders from the real ledger state — what you see is what is recorded.',
  },
];

const NODE_W = 150;
const NODE_H = 80;
const NODE_Y = 44;
const GAP = 18;
const STEP = NODE_W + GAP;

function nodeX(i: number) {
  return 1 + i * STEP;
}

export function LogicChainDiagram() {
  return (
    <figure aria-label="Request lifecycle diagram">
      {/* Desktop / tablet: horizontal SVG chain */}
      <div className="hidden md:block">
        <svg
          viewBox="0 0 1159 190"
          className="h-auto w-full"
          role="img"
          aria-labelledby="logic-chain-title logic-chain-desc"
        >
          <title id="logic-chain-title">The VMS request chain</title>
          <desc id="logic-chain-desc">
            Every request flows through seven stages: middleware, authentication,
            permission check, database transaction, audit log entry, and finally
            the updated UI. Requests denied at any gate are still logged.
          </desc>

          {/* Rejection path — denied at gates 2–4, still audited */}
          <g aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <path
                key={i}
                d={`M ${nodeX(i) + NODE_W / 2} ${NODE_Y + NODE_H} v 26`}
                fill="none"
                strokeDasharray="4 4"
                className="stroke-destructive/70"
                strokeWidth="1.5"
              />
            ))}
            <path
              d={`M ${nodeX(1) + NODE_W / 2} ${NODE_Y + NODE_H + 26} h ${2 * STEP}`}
              fill="none"
              strokeDasharray="4 4"
              className="stroke-destructive/70"
              strokeWidth="1.5"
            />
            <path
              d={`M ${nodeX(2) + NODE_W / 2} ${NODE_Y + NODE_H + 26} v 12`}
              fill="none"
              strokeDasharray="4 4"
              className="stroke-destructive/70"
              strokeWidth="1.5"
            />
            <rect
              x={nodeX(2) + NODE_W / 2 - 105}
              y={NODE_Y + NODE_H + 38}
              width="210"
              height="22"
              rx="11"
              className="fill-destructive/10"
            />
            <text
              x={nodeX(2) + NODE_W / 2}
              y={NODE_Y + NODE_H + 53}
              textAnchor="middle"
              className="fill-foreground"
              fontSize="10.5"
            >
              Denied requests are logged too
            </text>
          </g>

          {/* Connector arrows */}
          <g aria-hidden="true">
            {STEPS.slice(0, -1).map((_, i) => {
              const x1 = nodeX(i) + NODE_W;
              const midY = NODE_Y + NODE_H / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1 + 2} ${midY} h ${GAP - 6} M ${x1 + GAP - 8} ${midY - 5} l 6 5 -6 5`}
                  fill="none"
                  className="stroke-muted-foreground"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* Nodes */}
          {STEPS.map((step, i) => {
            const x = nodeX(i);
            const cx = x + NODE_W / 2;
            return (
              <g key={step.title}>
                {/* step number badge */}
                <circle
                  cx={cx}
                  cy={NODE_Y - 16}
                  r="11"
                  className="fill-primary"
                />
                <text
                  x={cx}
                  y={NODE_Y - 16}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-primary-foreground"
                  fontSize="11"
                  fontWeight="700"
                >
                  {i + 1}
                </text>
                <rect
                  x={x}
                  y={NODE_Y}
                  width={NODE_W}
                  height={NODE_H}
                  rx="10"
                  className="fill-card stroke-border"
                  strokeWidth="1.5"
                />
                <text
                  x={cx}
                  y={NODE_Y + 26}
                  textAnchor="middle"
                  className="fill-foreground"
                  fontSize="13"
                  fontWeight="600"
                >
                  {step.title}
                </text>
                {step.lines.map((line, li) => (
                  <text
                    key={li}
                    x={cx}
                    y={NODE_Y + 46 + li * 15}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                    fontSize="10.5"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Small screens: vertical chain with the same content */}
      <ol className="relative space-y-6 border-l-2 border-border pl-6 md:hidden">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            >
              {i + 1}
            </span>
            <p className="text-sm font-semibold">{step.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{step.note}</p>
          </li>
        ))}
        <li className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-destructive/15 text-destructive"
          >
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </span>
          <p className="text-sm font-semibold">Denied? Still logged.</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Failed auth and permission checks write an audit entry too — the log
            records attempts, not just successes.
          </p>
        </li>
      </ol>
    </figure>
  );
}
