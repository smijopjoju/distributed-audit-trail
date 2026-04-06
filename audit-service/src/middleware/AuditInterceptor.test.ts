import request from 'supertest';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { auditInterceptor } from './AuditInterceptor';
import { AuditProducerFactory } from '../services/AuditProducerFactory';
import { IAuditProducer } from '../services/IAuditProducer';
import { AuditEvent } from '../types/audit.types';

/**
 * Mock Producer for testing to capture events and verify assertions.
 */
class TestProducer implements IAuditProducer {
  public events: AuditEvent[] = [];
  public async publish(event: AuditEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

describe('AuditInterceptor Integration Test', () => {
  let app: express.Express;
  let testProducer: TestProducer;
  const secret = 'test-secret';

  beforeEach(() => {
    testProducer = new TestProducer();
    AuditProducerFactory.setProducer(testProducer);

    app = express();
    app.use(express.json());
    
    // Attach the middleware
    app.use(auditInterceptor);

    // Mock GraphQL endpoint
    app.post('/graphql', (req: Request, res: Response) => {
      res.status(200).json({ data: { success: true } });
    });
  });

  it('should intercept, redact, and publish an audit event for a mutation', async () => {
    // 1. Generate a valid JWT
    const token = jwt.sign(
      { 
        sub: 'user-123', 
        permissions: ['TRADING_ACCESS'], 
        mfa_verified: true 
      }, 
      secret
    );

    // 2. Mock a GraphQL "placeOrder" mutation
    const graphqlPayload = {
      operationName: 'placeOrder',
      variables: {
        portfolioId: 'port-789',
        input: {
          isin: 'DE000BASF111',
          side: 'BUY',
          numberOfShares: 10,
          secretInternalKey: 'SHOULD_BE_REDACTED' // Not in allow-list
        }
      }
    };

    // 3. Execute the request
    const response = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .set('x-forwarded-for', '1.2.3.4')
      .set('x-device-id', 'device-xyz')
      .send(graphqlPayload);

    // 4. Assertions
    expect(response.status).toBe(200);
    expect(testProducer.events.length).toBe(1);

    const event = testProducer.events[0];
    expect(event.operationName).toBe('placeOrder');
    expect(event.userId).toBe('user-123');
    expect(event.clientIp).toBe('1.2.3.4');
    expect(event.deviceId).toBe('device-xyz');
    
    // Verify Redaction
    expect(event.arguments.portfolioId).toBe('port-789');
    const input = event.arguments.input as any;
    expect(input.isin).toBe('DE000BASF111');
    expect(input.secretInternalKey).toBe('[REDACTED]');
  });

  it('should block the request (Fail-Closed) if the producer fails', async () => {
    // Mock a failing producer
    const failingProducer: IAuditProducer = {
      publish: jest.fn().mockRejectedValue(new Error('Kinesis connection lost'))
    };
    AuditProducerFactory.setProducer(failingProducer);

    const token = jwt.sign({ sub: 'user-123', permissions: [], mfa_verified: true }, secret);

    const response = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ operationName: 'readPersonalData', variables: { personId: '123' } });

    // Assert Fail-Closed behavior
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Security Audit Failure');
  });
});
