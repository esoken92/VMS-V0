/**
 * lib/api/openapi — hand-built OpenAPI 3.0 document for /api/v1.
 * Kept deliberately minimal but accurate: every route, method, scope
 * requirement, and the shared error envelope. Served at
 * /api/v1/openapi.json and linked from /dashboard/integrations.
 */

export function buildOpenApiSpec(baseUrl: string) {
  const errorResponse = (description: string) => ({
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
      },
    },
  });

  const secured = [{ bearerAuth: [] as string[] }];
  const dataArray = (itemRef: string) => ({
    type: 'object',
    properties: {
      data: { type: 'array', items: { $ref: itemRef } },
    },
  });
  const dataObject = (itemRef: string) => ({
    type: 'object',
    properties: { data: { $ref: itemRef } },
  });

  return {
    openapi: '3.0.3',
    info: {
      title: 'VMS Inventory API',
      version: '1.0.0',
      description:
        'REST API for the VMS inventory system. Authenticate with ' +
        '`Authorization: Bearer vms_…` (scoped API key from ' +
        '/dashboard/integrations) or the dashboard session cookie. ' +
        'Scopes: read < write < admin. Rate limit: 60 req/min per key. ' +
        'Errors use { "error": { "code", "message" } }.',
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'vms_…' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'unauthenticated',
                    'forbidden',
                    'forbidden_scope',
                    'validation',
                    'not_found',
                    'conflict',
                    'rate_limited',
                    'internal',
                  ],
                },
                message: { type: 'string' },
              },
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sku: { type: 'string' },
            name: { type: 'string' },
            item_type: { type: 'string', enum: ['consumable', 'fluid', 'tool', 'tire'] },
            current_stock: { type: 'number' },
            min_threshold: { type: 'number' },
            average_cost: { type: 'number' },
            unit_of_measure: { type: 'string' },
            issuing_unit: { type: 'string' },
            bin_location_id: { type: 'string', format: 'uuid', nullable: true },
            supplier_id: { type: 'string', format: 'uuid', nullable: true },
            weight_per_unit_kg: { type: 'number' },
            carries_core_charge: { type: 'boolean' },
            core_charge_amount: { type: 'number' },
            last_movement_date: { type: 'string', format: 'date-time', nullable: true },
            zone: { type: 'string', nullable: true },
            bin_location: { type: 'string', nullable: true },
          },
        },
        StockLevel: {
          type: 'object',
          properties: {
            product_id: { type: 'string', format: 'uuid' },
            sku: { type: 'string' },
            name: { type: 'string' },
            item_type: { type: 'string' },
            current_stock: { type: 'number' },
            min_threshold: { type: 'number' },
            unit_of_measure: { type: 'string' },
            low: { type: 'boolean' },
          },
        },
        Movement: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid' },
            product_sku: { type: 'string', nullable: true },
            product_name: { type: 'string', nullable: true },
            product_unit: { type: 'string', nullable: true },
            user_id: { type: 'string', format: 'uuid' },
            user_name: { type: 'string', nullable: true },
            type: {
              type: 'string',
              enum: ['inbound', 'outbound', 'adjustment', 'scrap', 'tool_checkout', 'receiving'],
            },
            quantity: { type: 'number', description: 'Signed: inbound/adjustment/receiving add, others subtract' },
            reason: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Loan: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tool_product_id: { type: 'string', format: 'uuid' },
            product_sku: { type: 'string', nullable: true },
            product_name: { type: 'string', nullable: true },
            worker_profile_id: { type: 'string', format: 'uuid' },
            worker_name: { type: 'string', nullable: true },
            checked_out_at: { type: 'string', format: 'date-time', nullable: true },
            expected_return_at: { type: 'string', format: 'date-time', nullable: true },
            returned_at: { type: 'string', format: 'date-time', nullable: true },
            condition_on_checkout: { type: 'string', nullable: true },
            condition_on_return: { type: 'string', nullable: true },
          },
        },
        StockTake: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['open', 'completed'] },
            started_by_name: { type: 'string', nullable: true },
            started_at: { type: 'string', format: 'date-time', nullable: true },
            completed_at: { type: 'string', format: 'date-time', nullable: true },
            items_counted: { type: 'integer' },
            items_total: { type: 'integer' },
          },
        },
        MovementCreate: {
          type: 'object',
          required: ['type', 'quantity'],
          properties: {
            product_id: { type: 'string', format: 'uuid' },
            sku: { type: 'string' },
            type: {
              type: 'string',
              enum: ['inbound', 'outbound', 'adjustment', 'scrap', 'tool_checkout', 'receiving'],
            },
            quantity: { type: 'number', exclusiveMinimum: 0 },
            reason: { type: 'string', nullable: true },
            scrap_image_url: { type: 'string', nullable: true },
            client_ref: {
              type: 'string',
              maxLength: 64,
              nullable: true,
              description:
                'Caller idempotency key: a retry with the same value returns the original movement instead of posting twice.',
            },
          },
        },
        ProductUpsert: {
          type: 'object',
          required: ['sku', 'name', 'item_type', 'min_threshold', 'average_cost', 'unit_of_measure', 'issuing_unit'],
          properties: {
            sku: { type: 'string' },
            name: { type: 'string' },
            item_type: { type: 'string', enum: ['consumable', 'fluid', 'tool', 'tire'] },
            current_stock: { type: 'number' },
            min_threshold: { type: 'number' },
            average_cost: { type: 'number' },
            unit_of_measure: { type: 'string' },
            issuing_unit: { type: 'string' },
            supplier_id: { type: 'string', format: 'uuid', nullable: true },
            bin_location_id: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        LoanCheckout: {
          type: 'object',
          required: ['condition_on_checkout'],
          properties: {
            tool_product_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
            tool_skus: { type: 'array', items: { type: 'string' } },
            worker_profile_id: { type: 'string', format: 'uuid', nullable: true },
            expected_return_at: { type: 'string', format: 'date-time', nullable: true },
            condition_on_checkout: { type: 'string' },
            notes: { type: 'string', nullable: true },
          },
        },
        LoanReturn: {
          type: 'object',
          required: ['condition_on_return'],
          properties: {
            loan_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
            tool_product_id: { type: 'string', format: 'uuid' },
            tool_sku: { type: 'string' },
            condition_on_return: { type: 'string' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Liveness + DB probe (unauthenticated)',
          security: [],
          responses: {
            '200': { description: 'Service healthy' },
            '503': { description: 'DB unreachable' },
          },
        },
      },
      '/products': {
        get: {
          summary: 'List/search products',
          security: secured,
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'SKU/name substring' },
            { name: 'item_type', in: 'query', schema: { type: 'string', enum: ['consumable', 'fluid', 'tool', 'tire'] } },
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 500 } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            '200': {
              description: 'Product list',
              content: { 'application/json': { schema: dataArray('#/components/schemas/Product') } },
            },
            '401': errorResponse('Missing/invalid credentials'),
            '403': errorResponse('Missing read scope'),
          },
        },
        post: {
          summary: 'Create a product (write scope + products:write)',
          security: secured,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductUpsert' } } },
          },
          responses: {
            '201': {
              description: 'Created product',
              content: { 'application/json': { schema: dataObject('#/components/schemas/Product') } },
            },
            '400': errorResponse('Validation failure'),
            '403': errorResponse('Missing write scope or products:write'),
          },
        },
      },
      '/products/{id}': {
        get: {
          summary: 'Get one product by id or SKU',
          security: secured,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Product',
              content: { 'application/json': { schema: dataObject('#/components/schemas/Product') } },
            },
            '404': errorResponse('Not found'),
          },
        },
        patch: {
          summary: 'Partial product update (write scope)',
          security: secured,
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductUpsert' } } },
          },
          responses: {
            '200': {
              description: 'Updated product',
              content: { 'application/json': { schema: dataObject('#/components/schemas/Product') } },
            },
            '404': errorResponse('Not found'),
          },
        },
      },
      '/stock': {
        get: {
          summary: 'Stock levels (optionally filter by product_id / sku / only_low)',
          security: secured,
          parameters: [
            { name: 'product_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'sku', in: 'query', schema: { type: 'string' } },
            { name: 'only_low', in: 'query', schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 1000 } },
          ],
          responses: {
            '200': {
              description: 'Levels',
              content: { 'application/json': { schema: dataArray('#/components/schemas/StockLevel') } },
            },
          },
        },
      },
      '/movements': {
        get: {
          summary: 'Ledger entries, newest first (own rows unless read:all role)',
          security: secured,
          parameters: [
            { name: 'product_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'days', in: 'query', schema: { type: 'integer', maximum: 365 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 200 } },
          ],
          responses: {
            '200': {
              description: 'Movements',
              content: { 'application/json': { schema: dataArray('#/components/schemas/Movement') } },
            },
          },
        },
        post: {
          summary: 'Append a stock movement (write scope; role gates type)',
          security: secured,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/MovementCreate' } } },
          },
          responses: {
            '201': { description: '{ movement_id, new_stock }' },
            '400': errorResponse('Validation failure'),
            '403': errorResponse('Role cannot record this movement type'),
            '409': errorResponse('Insufficient stock'),
          },
        },
      },
      '/loans': {
        get: {
          summary: 'Tool loans (own rows unless read:all role); ?active_only=1',
          security: secured,
          parameters: [
            { name: 'active_only', in: 'query', schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', maximum: 500 } },
          ],
          responses: {
            '200': {
              description: 'Loans',
              content: { 'application/json': { schema: dataArray('#/components/schemas/Loan') } },
            },
          },
        },
        post: {
          summary: 'Check out tools — or return them with ?action=return',
          security: secured,
          parameters: [
            { name: 'action', in: 'query', schema: { type: 'string', enum: ['return'] } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/LoanCheckout' },
                    { $ref: '#/components/schemas/LoanReturn' },
                  ],
                },
              },
            },
          },
          responses: {
            '201': { description: 'Checkout: { count, loan_ids }' },
            '200': { description: 'Return: { count }' },
            '403': errorResponse('Checkout-for-other / return-of-other denied'),
            '409': errorResponse('Tool already checked out / already returned'),
          },
        },
      },
      '/takes': {
        get: {
          summary: 'Stock takes with progress; ?id=<uuid> returns its items',
          security: secured,
          parameters: [{ name: 'id', in: 'query', schema: { type: 'string', format: 'uuid' } }],
          responses: {
            '200': {
              description: 'Takes or take items',
              content: { 'application/json': { schema: dataArray('#/components/schemas/StockTake') } },
            },
          },
        },
        post: {
          summary: 'Open a stock take (write scope + stock_takes:write)',
          security: secured,
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { notes: { type: 'string', nullable: true } },
                },
              },
            },
          },
          responses: { '201': { description: '{ id }' } },
        },
      },
      '/low-stock': {
        get: {
          summary: 'Products at or below min_threshold',
          security: secured,
          responses: {
            '200': {
              description: 'Low-stock levels',
              content: { 'application/json': { schema: dataArray('#/components/schemas/StockLevel') } },
            },
          },
        },
      },
      '/audit': {
        get: {
          summary: 'Activity log (admin scope + admin/super_admin role)',
          security: secured,
          parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 500 } }],
          responses: {
            '200': { description: 'Activity rows' },
            '403': errorResponse('Missing admin scope or admin role'),
          },
        },
      },
    },
  };
}
