import Link from 'next/link';
import { buildOpenApiSpec } from '@/lib/api/openapi';
import type { Metadata } from 'next';

/**
 * /docs — browsable API reference (roadmap item 65). Renders the same
 * hand-built spec served at /api/v1/openapi.json, so the page can never
 * drift from the machine-readable contract. Server-rendered, zero deps —
 * Swagger/Scalar via CDN would break air-gapped installs.
 */

export const metadata: Metadata = { title: 'API Reference — VMS V0' };
export const dynamic = 'force-dynamic';

interface Param {
  name: string;
  in: string;
  required?: boolean;
  schema?: { type?: string; format?: string; enum?: string[] };
  description?: string;
}
interface Media {
  schema?: { $ref?: string; type?: string; properties?: Record<string, unknown>; required?: string[]; items?: unknown };
}
interface Operation {
  summary?: string;
  parameters?: Param[];
  requestBody?: { content?: Record<string, Media> };
  responses?: Record<string, { description?: string; content?: Record<string, Media> }>;
}
type PathItem = Record<string, Operation | undefined>;

const METHOD_ORDER = ['get', 'post', 'patch', 'put', 'delete'] as const;
const METHOD_STYLE: Record<string, string> = {
  get: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  post: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
  patch: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  put: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
  delete: 'bg-red-500/15 text-red-400 border-red-500/40',
};

function schemaName(media: Media | undefined): string | null {
  const ref = media?.schema?.$ref;
  if (ref) return ref.split('/').pop() ?? null;
  if (media?.schema?.type) return media.schema.type;
  return null;
}

export default function DocsPage() {
  const spec = buildOpenApiSpec(
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  ) as {
    info: { title: string; version: string; description: string };
    servers: { url: string }[];
    paths: Record<string, PathItem>;
    components: { schemas: Record<string, { type?: string; properties?: Record<string, { type?: string; description?: string }>; required?: string[] }> };
  };

  const groups = new Map<string, { path: string; method: string; op: Operation }[]>();
  for (const [path, item] of Object.entries(spec.paths)) {
    const prefix = '/' + (path.split('/')[1] ?? '');
    const list = groups.get(prefix) ?? [];
    for (const m of METHOD_ORDER) {
      const op = item[m];
      if (op) list.push({ path, method: m, op });
    }
    groups.set(prefix, list);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <header className="mb-10">
          <p className="text-xs font-mono text-muted-foreground mb-2">
            <Link href="/" className="hover:text-foreground">← VMS V0</Link>
          </p>
          <h1 className="text-3xl font-bold">{spec.info.title}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            {spec.info.description}
          </p>
          <div className="flex flex-wrap gap-3 mt-4 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-md bg-muted border border-border">
              base <span className="text-primary">{spec.servers[0]?.url}</span>
            </span>
            <a
              href="/api/v1/openapi.json"
              className="px-3 py-1.5 rounded-md bg-muted border border-border hover:bg-muted/70"
            >
              openapi.json ↓
            </a>
            <a
              href="/llms.txt"
              className="px-3 py-1.5 rounded-md bg-muted border border-border hover:bg-muted/70"
            >
              llms.txt
            </a>
          </div>
        </header>

        {Array.from(groups.entries()).map(([prefix, ops]) => (
          <section key={prefix} className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-2">
              {prefix}
            </h2>
            <div className="space-y-3">
              {ops.map(({ path, method, op }) => (
                <details
                  key={`${method} ${path}`}
                  className="group rounded-xl border border-border bg-card overflow-hidden"
                >
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 list-none">
                    <span
                      className={`px-2 py-0.5 rounded border text-[11px] font-bold font-mono uppercase w-16 text-center shrink-0 ${METHOD_STYLE[method]}`}
                    >
                      {method}
                    </span>
                    <code className="text-sm font-mono text-foreground">{path}</code>
                    <span className="text-sm text-muted-foreground truncate">{op.summary}</span>
                  </summary>
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
                    {op.parameters && op.parameters.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Parameters</h4>
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="py-1 pr-3">name</th>
                              <th className="py-1 pr-3">in</th>
                              <th className="py-1 pr-3">type</th>
                              <th className="py-1">req</th>
                            </tr>
                          </thead>
                          <tbody>
                            {op.parameters.map((p) => (
                              <tr key={p.name} className="border-t border-border/50">
                                <td className="py-1.5 pr-3 text-foreground">{p.name}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">{p.in}</td>
                                <td className="py-1.5 pr-3 text-muted-foreground">
                                  {p.schema?.type}
                                  {p.schema?.format ? ` · ${p.schema.format}` : ''}
                                </td>
                                <td className="py-1.5">{p.required ? <span className="text-amber-400">yes</span> : <span className="text-muted-foreground/50">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {op.requestBody && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Request body</h4>
                        <p className="text-xs font-mono text-muted-foreground">
                          {schemaName(op.requestBody.content?.['application/json']) ?? 'application/json'}
                        </p>
                      </div>
                    )}
                    {op.responses && (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Responses</h4>
                        <div className="space-y-1">
                          {Object.entries(op.responses).map(([code, r]) => (
                            <div key={code} className="flex items-baseline gap-3 text-xs font-mono">
                              <span className={`w-8 shrink-0 ${code.startsWith('2') ? 'text-emerald-400' : 'text-red-400'}`}>{code}</span>
                              <span className="text-muted-foreground">
                                {r.description}
                                {schemaName(r.content?.['application/json']) && (
                                  <span className="text-primary/70"> · {schemaName(r.content?.['application/json'])}</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 border-b border-border pb-2">
            Schemas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(spec.components.schemas).map(([name, s]) => (
              <details key={name} className="rounded-xl border border-border bg-card overflow-hidden">
                <summary className="px-4 py-2.5 cursor-pointer hover:bg-muted/40 list-none font-mono text-sm text-foreground">
                  {name}
                </summary>
                <div className="px-4 pb-3 pt-1 border-t border-border">
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {Object.entries(s.properties ?? {}).map(([prop, def]) => (
                        <tr key={prop} className="border-t border-border/50 first:border-t-0">
                          <td className="py-1.5 pr-3 text-foreground">
                            {prop}
                            {s.required?.includes(prop) && <span className="text-amber-400">*</span>}
                          </td>
                          <td className="py-1.5 text-muted-foreground">{def.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground">
          VMS V0 — self-hosted, zero telemetry. Spec served at{' '}
          <code className="text-foreground">/api/v1/openapi.json</code>; MCP
          endpoint at <code className="text-foreground">/api/mcp</code>.
        </footer>
      </div>
    </div>
  );
}
