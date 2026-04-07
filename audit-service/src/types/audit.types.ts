import { z } from 'zod';

/**
 * Zod schema for Decoded JWT Token.
 * Used for runtime validation of the incoming Authorization header content.
 */
export const DecodedTokenSchema = z.object({
  sub: z.string().describe('The Unique User Identifier'),
  permissions: z.array(z.string()).describe('List of scoped permissions/roles'),
  mfa_verified: z.boolean().describe('Indicates if MFA was completed'),
});

export type DecodedToken = z.infer<typeof DecodedTokenSchema>;

/**
 * Zod schema for AuditEvent.
 * This represents the structured payload being sent to Amazon Kinesis.
 * Ensuring a rigid schema here prevents "schema drift" in the downstream data lake (Athena).
 */
export const AuditEventSchema = z.object({
  timestamp: z.string().datetime().describe('ISO 8601 UTC timestamp of the event'),
  userId: z.string().describe('The sub claim from JWT'),
  operationName: z.string().describe('The GraphQL operation name (e.g., placeOrder)'),
  clientIp: z.string().describe('Captured from x-forwarded-for'),
  deviceId: z.string().describe('Captured from x-device-id'),
  permissions: z.array(z.string()).describe('The user permissions at time of request'),
  arguments: z.record(z.string(), z.any()).describe('The sanitized/masked GraphQL variables'),
  metadata: z.record(z.string(), z.string()).describe('Additional contextual headers or environment data'),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
