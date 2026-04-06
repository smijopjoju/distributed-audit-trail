import { AuditEvent, AuditEventSchema } from "../types/audit.types";
import { IAuditProducer } from "./IAuditProducer";

/**
 * Mock Implementation of Kinesis Producer.
 * Aligned with production AWS Kinesis PutRecord performance:
 * - P50 (Audit-only): ~20ms
 * - P95 (Audit-only): ~40ms
 * - P99 (Audit-only): ~80ms (Tail Latency caused by Kinesis 3-AZ replication)
 */
export class MockKinesisProducer implements IAuditProducer {
  private readonly NORMAL_MIN = 10;
  private readonly NORMAL_MAX = 45; // Median ~27ms, P95 ~43ms
  private readonly SPIKE_MIN = 75;
  private readonly SPIKE_MAX = 95;
  private readonly SPIKE_CHANCE = 0.01; // 1% chance ensures P99 lands in the 75-95ms range
  private readonly FAILURE_RATE = 0.001; // 0.1% chance of random network failure

  public async publish(event: AuditEvent): Promise<void> {
    // 1. Validate Schema
    AuditEventSchema.parse(event);

    // 2. Determine Latency (Normal vs Spike)
    const isSpike = Math.random() < this.SPIKE_CHANCE;
    const min = isSpike ? this.SPIKE_MIN : this.NORMAL_MIN;
    const max = isSpike ? this.SPIKE_MAX : this.NORMAL_MAX;
    
    const latency = Math.floor(Math.random() * (max - min + 1) + min);
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // 3. Simulate Random Network Failure
        if (Math.random() < this.FAILURE_RATE) {
          return reject(new Error("Mock Network Error: Connection reset by peer"));
        }

        if (!isSpike) {
          // Log only spikes or failures to keep the perf-test output clean
           console.log(`[MOCK_KINESIS_ACK] ${latency}ms`);
        } else {
          console.warn(`[MOCK_KINESIS_SPIKE] ${latency}ms (Triggers Timeout)`);
        }
        
        resolve();
      }, latency);
    });
  }
}
