import type { NextRequest } from 'next/server';
import { buildLlmsTxt } from '@/lib/mcp/manifest';

export const dynamic = 'force-dynamic';

/**
 * GET /api/llms — the same manifest as /llms.txt, generated live so it
 * always reflects the current tool registry. Unauthenticated by design:
 * it's a discovery document, not data.
 */
export async function GET(req: NextRequest) {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(
    /\/$/,
    '',
  );
  return new Response(buildLlmsTxt(baseUrl), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
