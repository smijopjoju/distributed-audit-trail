import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuditProducerFactory } from "../services/AuditProducerFactory";
import { DecodedTokenSchema, AuditEvent } from "../types/audit.types";
import { redactArguments } from "../config/allow-list";

// Shared failure counter for Circuit Breaker logic
let auditFailureCount = 0;
const FAILURE_THRESHOLD = 100; // Threshold before alerting or taking more drastic action

export async function auditInterceptor(req: Request, res: Response, next: NextFunction) {
  // Access the global producer (resolves at runtime to support DI/Testing)
  const producer = AuditProducerFactory.getProducer();

  // 1. Extract Metadata
  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
  const deviceId = (req.headers["x-device-id"] as string) || "unknown";
  
  // 2. Extract & Decode JWT
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // In a real system, we might block or log an anonymous access event
    return next();
  }

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    // Note: In production, we would use jwt.verify with a public key/secret
    decoded = jwt.decode(token);
    const validatedToken = DecodedTokenSchema.parse(decoded);

    // 3. Extract GraphQL Context (Assuming Apollo/Express structure)
    // We expect operations to have operationName and variables
    const { operationName, variables } = req.body || {};
    
    // Only intercept specific GraphQL operations
    if (!operationName) return next();

    // 4. Redaction Logic
    const sanitizedArgs = redactArguments(variables || {});

    // 5. Build Audit Event
    const event: AuditEvent = {
      timestamp: new Date().toISOString(),
      userId: validatedToken.sub,
      operationName,
      clientIp,
      deviceId,
      permissions: validatedToken.permissions,
      arguments: sanitizedArgs,
      metadata: {
        mfa_verified: String(validatedToken.mfa_verified),
        user_agent: req.headers["user-agent"] || "unknown",
      },
    };

    // 6. Synchronous Publish to Kinesis
    // Performance: We AWAIT the publisher to ensure Sync ACK.
    // STAFF-LEVEL TRADE-OFF: We are now implementing a "Fail-Closed" strategy.
    // Forensic integrity is prioritized over system availability. If we cannot
    // log the action, we MUST NOT allow the action to proceed.
    await producer.publish(event);

    // Reset failure counter on success
    auditFailureCount = 0;

  } catch (err) {
    // 7. FAIL-CLOSED / ERROR HANDLING
    auditFailureCount++;
    
    // LOG CRITICAL ERROR TO STDERR
    console.error(`[AUDIT_CRITICAL_FAILURE] Blocking request. Reason: ${err instanceof Error ? err.message : "Unknown error"}`);

    if (auditFailureCount > FAILURE_THRESHOLD) {
      console.error("[AUDIT_ALERT] Audit pipeline is down. Blocking all traffic to maintain forensic integrity.");
    }

    // FAIL-CLOSED: Stop the request and return a 500 error to the client.
    // This ensures that NO action (trade, withdrawal, read) happens without an audit trail.
    return res.status(500).json({
      error: "Security Audit Failure",
      message: "The operation could not be securely audited and has been blocked to maintain forensic integrity.",
      referenceId: new Date().getTime(), // In production, use a proper correlation ID
    });
  }

  next();
}
