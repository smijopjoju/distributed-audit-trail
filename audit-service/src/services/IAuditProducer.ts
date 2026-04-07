import { AuditEvent } from "../types/audit.types";

/**
 * Interface for Audit Event Producers.
 * This allows for Dependency Injection and environment-specific implementations
 * (e.g., Kinesis for Production, Console for Local/Test).
 */
export interface IAuditProducer {
  publish(event: AuditEvent): Promise<void>;
}
