import { IAuditProducer } from "./IAuditProducer";
import { KinesisProducer } from "./KinesisProducer";
import { MockKinesisProducer } from "./MockKinesisProducer";

/**
 * Factory to provide the correct IAuditProducer based on environment.
 */
export class AuditProducerFactory {
  private static instance: IAuditProducer;

  /**
   * Manually sets the producer instance.
   * Useful for testing and manual DI.
   */
  public static setProducer(producer: IAuditProducer): void {
    AuditProducerFactory.instance = producer;
  }

  /**
   * Returns a singleton instance of the appropriate producer.
   * Reusing the producer is critical to maintain TCP/TLS persistence in production.
   */
  public static getProducer(): IAuditProducer {
    if (AuditProducerFactory.instance) {
      return AuditProducerFactory.instance;
    }

    const env = process.env.NODE_ENV || 'local';

    if (env === 'local' || env === 'test') {
      AuditProducerFactory.instance = new MockKinesisProducer();
    } else {
      AuditProducerFactory.instance = new KinesisProducer();
    }

    return AuditProducerFactory.instance;
  }
}
