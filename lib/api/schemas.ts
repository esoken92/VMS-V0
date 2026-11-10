/**
 * lib/api/schemas — Zod schemas shared by the REST v1 route bodies and
 * the MCP tool arguments (single source of truth; MCP inputSchemas are
 * generated from these via z.toJSONSchema).
 */

import { z } from 'zod';
import { ITEM_TYPES, MOVEMENT_TYPES } from '@/lib/auth/roles';
import { API_SCOPES } from '@/drizzle/api-schema';

export const uuidSchema = z.string().uuid();

/**
 * Query-param boolean — z.coerce.boolean() treats '0'/'false' as true
 * (non-empty string), so we enumerate the accepted literals instead.
 */
export const boolParam = z
  .enum(['true', '1', 'yes', 'false', '0', 'no'])
  .transform((v) => v === 'true' || v === '1' || v === 'yes')
  .optional();

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const productListQuery = paginationQuery.extend({
  q: z.string().trim().min(1).max(200).optional(),
  item_type: z.enum(ITEM_TYPES).optional(),
});

export const movementListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  product_id: uuidSchema.optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const loanListQuery = z.object({
  active_only: boolParam,
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const auditListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const createMovementBody = z
  .object({
    product_id: uuidSchema.optional(),
    sku: z.string().trim().min(1).max(100).optional(),
    type: z.enum(MOVEMENT_TYPES),
    quantity: z.number().positive('Quantity must be positive'),
    reason: z.string().max(1000).nullable().optional(),
    scrap_image_url: z.string().max(1000).nullable().optional(),
  })
  .refine((v) => v.product_id || v.sku, {
    message: 'Provide product_id or sku',
  });

export const checkoutLoanBody = z
  .object({
    tool_product_ids: z.array(uuidSchema).max(100).optional(),
    tool_skus: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    worker_profile_id: uuidSchema.nullable().optional(),
    expected_return_at: z.string().datetime().nullable().optional(),
    condition_on_checkout: z.string().trim().min(1).max(100),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((v) => (v.tool_product_ids?.length ?? 0) + (v.tool_skus?.length ?? 0) > 0, {
    message: 'Provide tool_product_ids or tool_skus',
  });

export const checkinLoanBody = z
  .object({
    loan_ids: z.array(uuidSchema).max(100).optional(),
    tool_product_id: uuidSchema.optional(),
    tool_sku: z.string().trim().min(1).max(100).optional(),
    condition_on_return: z.string().trim().min(1).max(100),
  })
  .refine((v) => v.loan_ids?.length || v.tool_product_id || v.tool_sku, {
    message: 'Provide loan_ids, tool_product_id, or tool_sku',
  });

export const startTakeBody = z.object({
  notes: z.string().max(1000).nullable().optional(),
});

export const upsertProductBody = z.object({
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(300),
  item_type: z.enum(ITEM_TYPES),
  current_stock: z.number().min(0).optional(),
  min_threshold: z.number().min(0),
  average_cost: z.number().min(0),
  unit_of_measure: z.string().trim().min(1).max(50),
  issuing_unit: z.string().trim().min(1).max(50),
  supplier_id: uuidSchema.nullable().optional(),
  bin_location_id: uuidSchema.nullable().optional(),
});

export const apiScopeSchema = z.enum(API_SCOPES);
