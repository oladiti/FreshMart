// zod schemas for order routes. Kept permissive on purpose: the controller
// owns stock/product/email business rules, while this bounds the shape so
// malformed payloads are rejected at the edge.

import { z } from 'zod';

export const createOrderSchema = z
  .object({
    items: z.array(z.record(z.any())).optional(),
    shippingAddress: z.record(z.any()).optional(),
    paymentMethod: z.string().max(50).optional(),
    customerEmail: z.string().max(200).optional(),
  })
  .passthrough();

export default { createOrderSchema };
