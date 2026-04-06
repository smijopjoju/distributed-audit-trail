import { AuditEvent, AuditEventSchema } from "../types/audit.types";
import { IAuditProducer } from "./IAuditProducer";

/**
 * Mock Implementation of Kinesis Producer.
 * Simulates network latency and occasional failures to test
 * the "Fail-Closed" and "50ms Timeout" logic without AWS credentials.
 */
export class MockKinesisProducer implements IAuditProducer {
  private readonly MIN_LATENCY = 10;
  private readonly MAX_LATENCY = 100; // Intentionally exceeds 50ms sometimes
  private readonly FAILURE_RATE = 0.05; // 5% chance of random network failure

  public async publish(event: AuditEvent): Promise<void> {
    // 1. Validate Schema (same as production)
    AuditEventSchema.parse(event);

    // 2. Simulate Network Latency
    const latency = Math.floor(Math.random() * (this.MAX_LATENCY - this.MIN_LATENCY + 1) + this.MIN_LATENCY);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 3. Simulate Random Network Failure
        if (Math.random() < this.FAILURE_RATE) {
          return reject(new Error("Mock Network Error: Connection reset by peer"));
        }

        console.log(`[MOCK_KINESIS_ACK] Event published in ${latency}ms (UserID: ${event.userId})`);
        resolve();
      }, latency);
    });
  }
}
