/**
 * lib/mcp/manifest — the machine-readable "AI can discover us" artifacts:
 * the llms.txt document and the MCP resource catalogue. One source of
 * truth shared by public/llms.txt (static mirror), GET /api/llms, and the
 * MCP resources/list + resources/read methods.
 */

import { API_SCOPES } from '@/drizzle/api-schema';
import { MCP_TOOLS } from './tools';

export const MCP_SERVER_INFO = {
  name: 'vms-mcp',
  version: '0.1.0',
  protocolVersion: '2024-11-05',
} as const;

export function buildLlmsTxt(baseUrl: string): string {
  const toolLines = MCP_TOOLS.map(
    (t) => `- \`${t.name}\` (${t.scope}) — ${t.description.split('.')[0]}.`,
  ).join('\n');

  return `# VMS — Vehicle Workshop Stores / Inventory Management

> Self-hosted inventory system (Next.js 14 + Postgres). This document is
> the machine-readable manifest of its agent-facing surface. See
> ${baseUrl}/api/v1/openapi.json for the REST spec.

## Authentication

Two credentials, checked in order:

1. **API key** — \`Authorization: Bearer vms_…\`. Scoped keys are issued at
   ${baseUrl}/dashboard/integrations (create/list/revoke). The plaintext
   key is shown once; the server stores a sha256 hash. Scopes:
   ${API_SCOPES.join(' | ')} — a read key cannot POST and cannot call
   write MCP tools.
2. **Dashboard session cookie** — same identity, implicitly fully scoped.

Either way, the owner's ROLE governs what is actually allowed (the
permission matrix is re-checked server-side on every request — a
read-scoped admin key still cannot exceed role limits, and vice versa).

Rate limit: 60 requests/minute per key (per user for sessions);
429 + Retry-After on excess. Error envelope:
\`{ "error": { "code": "unauthenticated|forbidden|forbidden_scope|validation|not_found|conflict|rate_limited|internal", "message": "…" } }\`

## MCP endpoint

\`POST ${baseUrl}/api/mcp\` — JSON-RPC 2.0, single HTTP POST transport
(no SSE). Methods: \`initialize\`, \`tools/list\`, \`tools/call\`,
\`resources/list\`, \`resources/read\`, \`ping\`. Batch requests are
supported; notifications return HTTP 202.

Tools advertised to a credential are filtered by its scopes:

${toolLines}

## REST API v1

Base: \`${baseUrl}/api/v1\` — spec: \`${baseUrl}/api/v1/openapi.json\`

| Route | Methods | Scope | Notes |
|---|---|---|---|
| /health | GET | none | liveness + DB probe |
| /products | GET, POST | read / write | ?q= ?item_type= ?limit= ?offset= |
| /products/{idOrSku} | GET, PATCH | read / write | |
| /stock | GET | read | ?product_id= ?sku= ?only_low=1 |
| /movements | GET, POST | read / write | ledger; own rows unless read:all role |
| /loans | GET, POST | read / write | POST ?action=return to check in |
| /takes | GET, POST | read / write | ?id=<uuid> returns take items |
| /low-stock | GET | read | at/below min_threshold |
| /audit | GET | admin | + admin/super_admin role |
| /openapi.json | GET | none | this API's OpenAPI 3.0 spec |

Quickstart:
\`\`\`bash
curl -H "Authorization: Bearer vms_…" ${baseUrl}/api/v1/stock
curl -X POST ${baseUrl}/api/mcp \\
  -H "Authorization: Bearer vms_…" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
\`\`\`
`;
}
