/**
 * Security Allow-list for GraphQL arguments.
 * Fields not listed here are treated as PII/Sensitive and automatically masked.
 */
export const APPROVED_ARGUMENT_KEYS = new Set([
  'portfolioId',
  'personId',
  'isin',
  'side',
  'numberOfShares',
]);

/**
 * Redacts sensitive GraphQL variables using the Security Allow-list.
 * 
 * Trade-off: We perform a shallow copy and transformation on every request. 
 * While this adds O(n) CPU overhead, it is critical for forensic integrity—
 * preventing accidental PII leaks into the immutable audit store.
 * 
 * @param args - The raw GraphQL variables
 * @returns A new object with unlisted keys masked
 */
export function redactArguments(args: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(args)) {
    // If it's an object (nested input), we MUST recurse to check its children
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = redactArguments(value);
    } 
    // If it's a leaf node, check the allow-list
    else if (APPROVED_ARGUMENT_KEYS.has(key)) {
      sanitized[key] = value;
    } 
    // Otherwise, redact
    else {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}
