// zod schemas for public forms. Fields stay optional so the controllers keep
// ownership of the required-field messages shown to users; the schemas bound
// sizes and types so oversized/malformed payloads are rejected early.

import { z } from 'zod';

export const contactSchema = z
  .object({
    name: z.string().max(200).optional(),
    email: z.string().max(200).optional(),
    subject: z.string().max(300).optional(),
    message: z.string().max(5000).optional(),
  })
  .passthrough();

export default { contactSchema };
