/**
 * lib/mcp/tools — MCP tool registry for the VMS endpoint.
 *
 * Each entry carries a zod schema that serves TWO purposes:
 *   1. validating tools/call `arguments` server-side
 *   2. generating the advertised JSON Schema via z.toJSONSchema
 *
 * Scopes: 'read' tools are visible+callable with a read-scoped key;
 * 'write' tools additionally need the write scope (and the caller's role
 * still governs — e.g. a staff key cannot post 'outbound' movements).
 * tools/list only advertises what the credential may actually call.
 */

import { z } from 'zod';
import {
  apiCheckinTools,
  apiCheckoutTools,
  apiGetProduct,
  apiGetTakeItems,
  apiListLoans,
  apiListProducts,
  apiListStockLevels,
  apiListStorerooms,
  apiListTakes,
  apiCreateMovement,
  apiRunReport,
  apiStartTake,
} from '@/lib/api/data';
import type { ApiPrincipal } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/http';
import type { ApiScope } from '@/drizzle/api-schema';
import { ITEM_TYPES, MOVEMENT_TYPES } from '@/lib/auth/roles';

const uuid = z.string().uuid();

/**
 * Registry entry — the zod schema is encapsulated: `call()` parses the raw
 * arguments itself, so heterogeneous tools can share one array without
 * `any`.
 */
export interface McpTool {
  name: string;
  description: string;
  scope: ApiScope;
  /** JSON Schema advertised over the wire (built from the zod schema). */
  inputSchema: Record<string, unknown>;
  /** Parse args → run. Throws ZodError / ApiError. */
  call: (args: unknown, principal: ApiPrincipal) => Promise<unknown>;
}

interface McpToolDef<A> {
  name: string;
  description: string;
  scope: ApiScope;
  schema: z.ZodType<A>;
  run: (args: A, principal: ApiPrincipal) => Promise<unknown>;
}

function tool<A>(def: McpToolDef<A>): McpTool {
  const json = z.toJSONSchema(def.schema, { io: 'input' }) as Record<string, unknown>;
  delete json.$schema;
  return {
    name: def.name,
    description: def.description,
    scope: def.scope,
    inputSchema: json,
    call: (args, p) => def.run(def.schema.parse(args), p),
  };
}

const emptyArgs = z.object({}).passthrough();

export const MCP_TOOLS: McpTool[] = [
  tool({
    name: 'search_products',
    description:
      'Search the product catalog by SKU or name substring. Returns products ' +
      'with current stock, thresholds, units and bin location.',
    scope: 'read',
    schema: z.object({
      query: z.string().min(1).max(200).describe('SKU or name substring'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results (default 10)'),
      item_type: z.enum(ITEM_TYPES).optional().describe('Filter by item type'),
    }),
    run: (args, p) =>
      apiListProducts(p, { query: args.query, itemType: args.item_type, limit: args.limit ?? 10 }),
  }),

  tool({
    name: 'get_stock_level',
    description:
      'Get the on-hand stock level for one product by id or SKU. Includes ' +
      'min_threshold and whether it is currently low.',
    scope: 'read',
    schema: z
      .object({
        product_id: uuid.optional().describe('Product UUID'),
        sku: z.string().min(1).max(100).optional().describe('Product SKU'),
      })
      .refine((v) => v.product_id || v.sku, { message: 'Provide product_id or sku' }),
    run: async (args, p) => {
      const product = await apiGetProduct(p, (args.product_id ?? args.sku) as string);
      return {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        current_stock: product.current_stock,
        min_threshold: product.min_threshold,
        unit_of_measure: product.unit_of_measure,
        low: product.current_stock <= product.min_threshold,
      };
    },
  }),

  tool({
    name: 'get_product_by_barcode',
    description:
      'Look up a product by scanned barcode. NOTE: a dedicated barcodes ' +
      'table is not yet implemented — the code is matched against product ' +
      'SKUs. Returns the full product record or a not-found message.',
    scope: 'read',
    schema: z.object({
      barcode: z.string().min(1).max(200).describe('Scanned code value'),
    }),
    run: async (args, p) => {
      try {
        return await apiGetProduct(p, args.barcode);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'not_found') {
          return {
            found: false,
            message: `No product with SKU/barcode '${args.barcode}'. ` +
              'A dedicated product_barcodes table is planned; until then ' +
              'barcodes must match the product SKU.',
          };
        }
        throw err;
      }
    },
  }),

  tool({
    name: 'list_low_stock',
    description: 'List every product at or below its min_threshold (reorder candidates).',
    scope: 'read',
    schema: z.object({
      limit: z.number().int().min(1).max(500).optional(),
    }),
    run: (args, p) => apiListStockLevels(p, { onlyLow: true, limit: args.limit }),
  }),

  tool({
    name: 'post_stock_movement',
    description:
      'Record a stock movement on the ledger. type inbound/receiving/' +
      'adjustment adds stock; outbound/scrap/tool_checkout removes it. ' +
      'The caller role restricts which types are allowed.',
    scope: 'write',
    schema: z
      .object({
        product_id: uuid.optional(),
        sku: z.string().min(1).max(100).optional(),
        type: z.enum(MOVEMENT_TYPES),
        quantity: z.number().positive(),
        reason: z.string().max(1000).optional(),
      })
      .refine((v) => v.product_id || v.sku, { message: 'Provide product_id or sku' }),
    run: (args, p) =>
      apiCreateMovement(p, {
        productId: args.product_id,
        sku: args.sku,
        type: args.type,
        quantity: args.quantity,
        reason: args.reason,
      }),
  }),

  tool({
    name: 'checkout_tool',
    description:
      'Check out a tool to a worker. Checking out for someone else requires ' +
      'the tool_loans:create:for_other permission.',
    scope: 'write',
    schema: z
      .object({
        tool_product_id: uuid.optional().describe('Tool product UUID'),
        tool_sku: z.string().min(1).max(100).optional().describe('Tool SKU'),
        worker_profile_id: uuid.optional().describe('Defaults to the caller'),
        expected_return_at: z.string().datetime().optional(),
        condition_on_checkout: z.string().min(1).max(100),
        notes: z.string().max(1000).optional(),
      })
      .refine((v) => v.tool_product_id || v.tool_sku, {
        message: 'Provide tool_product_id or tool_sku',
      }),
    run: (args, p) =>
      apiCheckoutTools(p, {
        toolIds: args.tool_product_id ? [args.tool_product_id] : undefined,
        toolSkus: args.tool_sku ? [args.tool_sku] : undefined,
        workerProfileId: args.worker_profile_id,
        expectedReturnAt: args.expected_return_at,
        conditionOnCheckout: args.condition_on_checkout,
        notes: args.notes,
      }),
  }),

  tool({
    name: 'checkin_tool',
    description:
      'Return a checked-out tool by loan id or by the tool itself (uses the ' +
      'active loan). Non-privileged roles can only return their own loans.',
    scope: 'write',
    schema: z
      .object({
        loan_id: uuid.optional(),
        tool_product_id: uuid.optional(),
        tool_sku: z.string().min(1).max(100).optional(),
        condition_on_return: z.string().min(1).max(100),
      })
      .refine((v) => v.loan_id || v.tool_product_id || v.tool_sku, {
        message: 'Provide loan_id, tool_product_id, or tool_sku',
      }),
    run: (args, p) =>
      apiCheckinTools(p, {
        loanIds: args.loan_id ? [args.loan_id] : undefined,
        toolProductId: args.tool_product_id,
        toolSku: args.tool_sku,
        conditionOnReturn: args.condition_on_return,
      }),
  }),

  tool({
    name: 'list_loans',
    description:
      'List tool loans. Roles without tool_loans:read:all only see loans ' +
      'they hold. Set active_only to list currently-checked-out tools.',
    scope: 'read',
    schema: z.object({
      active_only: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
    run: (args, p) => apiListLoans(p, { activeOnly: args.active_only, limit: args.limit }),
  }),

  tool({
    name: 'list_storerooms',
    description:
      'List storerooms (rooms/zones holding stock). When the storerooms ' +
      'migration has not been applied yet, returns a graceful ' +
      '"not yet implemented" result with bin locations as the equivalent.',
    scope: 'read',
    schema: emptyArgs,
    run: (_args, p) => apiListStorerooms(p),
  }),

  tool({
    name: 'start_stock_take',
    description: 'Open a new stock take (inventory count) with optional notes.',
    scope: 'write',
    schema: z.object({
      notes: z.string().max(1000).optional(),
    }),
    run: (args, p) => apiStartTake(p, { notes: args.notes }),
  }),

  tool({
    name: 'get_stock_take_items',
    description:
      'Fetch the counted items (system qty, physical qty, variance) of a ' +
      'stock take by id.',
    scope: 'read',
    schema: z.object({ stock_take_id: uuid }),
    run: (args, p) => apiGetTakeItems(p, args.stock_take_id),
  }),

  tool({
    name: 'list_stock_takes',
    description: 'List stock takes with progress (items counted / total).',
    scope: 'read',
    schema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    run: (args, p) => apiListTakes(p, { limit: args.limit }),
  }),

  tool({
    name: 'run_report',
    description:
      'Run a canned report: stock_summary, low_stock, movements, or loans. ' +
      'Data is role-scoped the same way as the REST endpoints.',
    scope: 'read',
    schema: z.object({
      report: z.enum(['stock_summary', 'low_stock', 'movements', 'loans']),
      days: z.number().int().min(1).max(365).optional().describe('Window for movements report'),
    }),
    run: (args, p) => apiRunReport(p, args.report, { days: args.days }),
  }),
];

/** Tools the principal's credential scopes allow. */
export function visibleTools(principal: ApiPrincipal): McpTool[] {
  return MCP_TOOLS.filter((t) => principal.scopes.includes(t.scope));
}

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}
