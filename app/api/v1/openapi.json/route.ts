import { apiJson } from '@/lib/api/http';
import { buildOpenApiSpec } from '@/lib/api/openapi';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/openapi.json — machine-readable spec. Unauthenticated by
 * design: it documents the surface (no data), and agents/discovery tools
 * need to reach it before they hold a key.
 */
export async function GET(req: NextRequest) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  return apiJson(buildOpenApiSpec(baseUrl.replace(/\/$/, '')));
}
