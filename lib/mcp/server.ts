/**
 * lib/mcp/server — JSON-RPC 2.0 dispatch for POST /api/mcp.
 *
 * Implements the MCP "streamable HTTP" transport subset:
 *   initialize, ping, tools/list, tools/call, resources/list,
 *   resources/read. Notifications (no `id`) get HTTP 202. Batch arrays
 *   are supported. No SSE stream — single POST → single JSON response.
 *
 * Auth is resolved by the route (resolveApiPrincipal) BEFORE dispatch;
 * tools/list advertises only what the credential's scopes allow, and
 * tools/call re-checks the scope at call time.
 */

import { ZodError } from 'zod';
import { requireApiScope, type ApiPrincipal } from '@/lib/api/auth';
import { apiListStockLevels, apiListBinLocations } from '@/lib/api/data';
import { ApiError } from '@/lib/api/http';
import { buildOpenApiSpec } from '@/lib/api/openapi';
import { buildLlmsTxt, MCP_SERVER_INFO } from './manifest';
import { findTool, visibleTools } from './tools';

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: unknown;
  id?: JsonRpcId;
  method?: unknown;
  params?: unknown;
}

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } };
}

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result };
}

function toolErrorResult(message: string) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function toolOkResult(data: unknown) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}

// ============================================================================
// Resources
// ============================================================================

interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

const RESOURCES: McpResource[] = [
  {
    uri: 'vms://meta/llms.txt',
    name: 'llms.txt',
    description: 'Machine-readable manifest of the VMS API/MCP surface',
    mimeType: 'text/plain',
  },
  {
    uri: 'vms://meta/openapi.json',
    name: 'openapi.json',
    description: 'OpenAPI 3.0 spec for the REST v1 API',
    mimeType: 'application/json',
  },
  {
    uri: 'vms://inventory/low-stock',
    name: 'low-stock',
    description: 'Products currently at or below min_threshold',
    mimeType: 'application/json',
  },
  {
    uri: 'vms://inventory/bin-locations',
    name: 'bin-locations',
    description: 'Zone/bin location catalogue',
    mimeType: 'application/json',
  },
];

async function readResource(
  uri: string,
  principal: ApiPrincipal,
  baseUrl: string,
): Promise<{ uri: string; mimeType: string; text: string }> {
  switch (uri) {
    case 'vms://meta/llms.txt':
      return { uri, mimeType: 'text/plain', text: buildLlmsTxt(baseUrl) };
    case 'vms://meta/openapi.json':
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(buildOpenApiSpec(baseUrl), null, 2),
      };
    case 'vms://inventory/low-stock':
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(await apiListStockLevels(principal, { onlyLow: true }), null, 2),
      };
    case 'vms://inventory/bin-locations':
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(await apiListBinLocations(principal), null, 2),
      };
    default:
      throw new ApiError('not_found', `Unknown resource '${uri}'`);
  }
}

// ============================================================================
// Method dispatch
// ============================================================================

async function handleMethod(
  method: string,
  params: unknown,
  principal: ApiPrincipal,
  baseUrl: string,
): Promise<unknown> {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: MCP_SERVER_INFO.protocolVersion,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        },
        serverInfo: { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version },
        instructions:
          'VMS inventory MCP server. Tools are scope-filtered: read keys ' +
          'see read tools only; mutations require a write-scoped key. ' +
          'All calls are governed by the owner role permission matrix.',
      };

    case 'ping':
      return {};

    case 'tools/list':
      return {
        tools: visibleTools(principal).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };

    case 'tools/call': {
      const p = (params ?? {}) as { name?: unknown; arguments?: unknown };
      if (typeof p.name !== 'string') {
        throw new JsonRpcError(INVALID_PARAMS, 'tools/call requires params.name');
      }
      const tool = findTool(p.name);
      if (!tool) {
        throw new JsonRpcError(INVALID_PARAMS, `Unknown tool '${p.name}'`);
      }
      // Scope enforcement — a read-only key cannot call write tools,
      // even though it can see them in a filtered tools/list.
      requireApiScope(principal, tool.scope);
      try {
        return toolOkResult(await tool.call(p.arguments ?? {}, principal));
      } catch (err) {
        // Tool execution failures are protocol-level results, not
        // JSON-RPC errors (per MCP spec) — including unexpected ones like
        // a DB outage, which surface as isError rather than -32603.
        if (err instanceof ZodError) {
          return toolErrorResult(
            `Invalid arguments: ${err.issues
              .map((i) => `${i.path.join('.')}: ${i.message}`)
              .join('; ')}`,
          );
        }
        if (err instanceof ApiError) {
          return toolErrorResult(`${err.code}: ${err.message}`);
        }
        return toolErrorResult(
          err instanceof Error ? err.message : 'Tool execution failed',
        );
      }
    }

    case 'resources/list':
      requireApiScope(principal, 'read');
      return { resources: RESOURCES };

    case 'resources/read': {
      requireApiScope(principal, 'read');
      const p = (params ?? {}) as { uri?: unknown };
      if (typeof p.uri !== 'string') {
        throw new JsonRpcError(INVALID_PARAMS, 'resources/read requires params.uri');
      }
      const contents = await readResource(p.uri, principal, baseUrl);
      return { contents: [contents] };
    }

    default:
      throw new JsonRpcError(METHOD_NOT_FOUND, `Method not found: '${method}'`);
  }
}

class JsonRpcError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Dispatch one JSON-RPC request object. Returns the response object, or
 * null for notifications (no `id`) — caller turns that into HTTP 202.
 */
async function dispatchOne(
  raw: JsonRpcRequest,
  principal: ApiPrincipal,
  baseUrl: string,
): Promise<Record<string, unknown> | null> {
  const isNotification = raw.id === undefined;
  const id = (raw.id ?? null) as JsonRpcId;

  if (raw.jsonrpc !== '2.0' || typeof raw.method !== 'string') {
    if (isNotification) return null;
    return rpcError(id, INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request');
  }
  // `notifications/*` methods never produce a response.
  if (isNotification || raw.method.startsWith('notifications/')) {
    return null;
  }

  try {
    const result = await handleMethod(raw.method, raw.params, principal, baseUrl);
    return rpcResult(id, result);
  } catch (err) {
    if (err instanceof JsonRpcError) return rpcError(id, err.code, err.message);
    if (err instanceof ApiError) {
      // Authz/validation failures map to server-defined codes in the
      // -32000..-32099 band rather than fake "internal error".
      const code =
        err.code === 'unauthenticated'
          ? -32001
          : err.code === 'forbidden' || err.code === 'forbidden_scope'
            ? -32003
            : err.code === 'not_found'
              ? -32004
              : INVALID_PARAMS;
      return rpcError(id, code, `${err.code}: ${err.message}`);
    }
    const message = err instanceof Error ? err.message : 'Internal error';
    return rpcError(id, INTERNAL_ERROR, message);
  }
}

export interface McpHttpResponse {
  status: number;
  body: unknown | null;
}

/** Entry point: parsed-or-raw request body → {status, body}. */
export async function dispatchMcp(
  bodyText: string,
  principal: ApiPrincipal,
  baseUrl: string,
): Promise<McpHttpResponse> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {
      status: 200,
      body: rpcError(null, PARSE_ERROR, 'Parse error: body is not valid JSON'),
    };
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        status: 200,
        body: rpcError(null, INVALID_REQUEST, 'Empty batch'),
      };
    }
    const responses = (
      await Promise.all(
        parsed.map((r) => dispatchOne(r as JsonRpcRequest, principal, baseUrl)),
      )
    ).filter((r): r is Record<string, unknown> => r !== null);
    if (responses.length === 0) return { status: 202, body: null };
    return { status: 200, body: responses };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      status: 200,
      body: rpcError(null, INVALID_REQUEST, 'Request must be an object or batch array'),
    };
  }

  const response = await dispatchOne(parsed as JsonRpcRequest, principal, baseUrl);
  if (response === null) return { status: 202, body: null };
  return { status: 200, body: response };
}
