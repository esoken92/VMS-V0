/**
 * POST /api/mcp — Model Context Protocol endpoint (JSON-RPC 2.0 over
 * single-POST HTTP; no SSE stream).
 *
 * Auth: `Authorization: Bearer vms_…` API key OR dashboard session
 * cookie — resolved by lib/api/auth, rate-limited 60 req/min, then
 * dispatched by lib/mcp/server. Tools are scope-filtered: read keys see
 * read tools; write tools need a write-scoped credential.
 *
 * Config snippets for Claude Desktop / Cursor live at
 * /dashboard/integrations and in public/llms.txt.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitKey, resolveApiPrincipal } from '@/lib/api/auth';
import { apiError, apiErrorResponse, rateLimitedResponse } from '@/lib/api/http';
import { checkRateLimit } from '@/lib/api/ratelimit';
import { dispatchMcp } from '@/lib/mcp/server';
import { MCP_SERVER_INFO } from '@/lib/mcp/manifest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function baseUrl(req: NextRequest): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const principal = await resolveApiPrincipal(req);
    const rate = checkRateLimit(rateLimitKey(principal));
    if (!rate.allowed) return rateLimitedResponse(rate.retryAfter);

    const body = await req.text();
    const response = await dispatchMcp(body, principal, baseUrl(req));

    if (response.status === 202 || response.body === null) {
      return new NextResponse(null, { status: 202 });
    }
    return NextResponse.json(response.body, { status: response.status });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/**
 * GET /api/mcp — discovery document (unauthenticated). The MCP transport
 * itself is POST-only; this exists so llms.txt/agents/clients probing the
 * URL get a machine-readable pointer instead of a bare 405.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    name: MCP_SERVER_INFO.name,
    version: MCP_SERVER_INFO.version,
    protocol: 'mcp',
    transport: 'http-jsonrpc-single-post',
    endpoint: `${baseUrl(req)}/api/mcp`,
    authentication: {
      methods: [
        'Authorization: Bearer vms_… (scoped API key)',
        'dashboard session cookie',
      ],
      issue_keys_at: `${baseUrl(req)}/dashboard/integrations`,
    },
    methods: ['initialize', 'ping', 'tools/list', 'tools/call', 'resources/list', 'resources/read'],
    discovery: `${baseUrl(req)}/llms.txt`,
  });
}

/** Other verbs get a JSON 405 that points at the real transport. */
export function PUT() {
  return apiError('validation', 'MCP transport is POST /api/mcp only', {
    status: 405,
    headers: { Allow: 'GET, POST' },
  });
}

export { PUT as DELETE, PUT as PATCH };
