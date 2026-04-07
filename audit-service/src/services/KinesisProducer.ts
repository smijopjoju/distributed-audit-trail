import { KinesisClient, PutRecordCommand } from "@aws-sdk/client-kinesis";
import { AuditEvent, AuditEventSchema } from "../types/audit.types";
import { IAuditProducer } from "./IAuditProducer";

/**
 * Custom error thrown when the Kinesis publishing exceeds the 
 * strict 50ms latency budget.
 */
export class AuditTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditTimeoutError";
  }
}

/**
 * AWS Kinesis Implementation of Audit Event Producer.
 * 
 * DESIGN RATIONALE:
 * Reusing the KinesisClient (and its underlying HTTP agent) is critical for 5000 RPS.
 * It avoids the overhead of repeated TCP/TLS handshakes, keeping P99 latency within 50ms.
 */
export class KinesisProducer implements IAuditProducer {
  private client: KinesisClient;
  private streamName: string;
  private readonly PUBLISH_TIMEOUT_MS = 50;

  constructor(region: string = "eu-central-1", streamName: string = "audit-trail-stream") {
    this.client = new KinesisClient({ 
      region,
      // The SDK v3 automatically uses a persistent HTTP agent, 
      // but we must ensure the client itself is reused.
    });
    this.streamName = streamName;
  }

  /**
   * Publishes an event to Kinesis with Synchronous Acknowledgement.
   * 
   * STAFF-LEVEL TRADE-OFF:
   * We use "Synchronous Broker Acknowledgement" here instead of fire-and-forget.
   * 
   * @param event - The AuditEvent to publish
   */
  public async publish(event: AuditEvent): Promise<void> {
    // Validate the event at runtime
    const validatedEvent = AuditEventSchema.parse(event);

    const command = new PutRecordCommand({
      StreamName: this.streamName,
      Data: Buffer.from(JSON.stringify(validatedEvent)),
      PartitionKey: validatedEvent.userId, // Ensures ordering per user and balanced shard distribution
    });

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AuditTimeoutError(`Audit log publish exceeded ${this.PUBLISH_TIMEOUT_MS}ms budget.`));
      }, this.PUBLISH_TIMEOUT_MS);
    });

    try {
      // Race between the actual SDK call and our timeout
      await Promise.race([
        this.client.send(command),
        timeoutPromise
      ]);
    } catch (err) {
      // Re-throw if it's already a timeout error, or wrap if it's a network/SDK failure
      if (err instanceof AuditTimeoutError) throw err;
      throw new Error(`Kinesis Publish Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
