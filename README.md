# Distributed Audit Trail System (Scalable Capital)

A high-scale, forensic-grade audit logging system designed to handle **100 million requests per day** with a strict **50ms latency budget**.

## 🏗️ Project Structure
```text
.
├── architecture/           # ADR-001 (Design Decisions) & C4 Diagrams
│   ├── ADR-001-distributed-audit-trail.md
│   └── architecture-diagram.mermaid
├── audit-service/          # TypeScript Reference Implementation
│   ├── src/
│   │   ├── middleware/     # GraphQL Audit Interceptor (Fail-Closed)
│   │   ├── services/       # Kinesis Producers (AWS & Mock)
│   │   ├── config/         # Security Allow-list (PII Redaction)
│   │   └── types/          # Zod Schemas & AuditEvent types
│   ├── package.json        # Dependencies (AWS SDK v3, Zod, Jest)
│   └── jest.config.js      # Testing Configuration
├── performance/            # Load testing scripts (e.g., k6/autocannon)
└── docs/                   # AI Usage Disclosure & Forensic Strategy
```

## 🚀 Getting Started (Audit Service)

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Installation
```bash
cd audit-service
npm install
```

### 3. Running the Service
The reference implementation includes a mock GraphQL server that uses the `AuditInterceptor`.

```bash
# Local Mode (Uses MockKinesisProducer with simulated latency)
npm start

# Production Mode (Requires AWS Credentials for Kinesis)
NODE_ENV=production npm start
```

### 4. Running Tests
The project includes comprehensive integration tests for JWT decoding, PII redaction, and **Fail-Closed** logic.

```bash
cd audit-service
npm test
```

## 🛡️ Core Security Features
- **Fail-Closed Strategy**: If auditing fails (e.g., Kinesis timeout), the request is blocked with a 500 error to ensure forensic integrity.
- **PII Redaction**: An automated allow-list approach ensures only approved GraphQL arguments are logged. Everything else is masked as `[REDACTED]`.
- **Latency Control**: A strict 50ms timeout on the Kinesis publish operation protects the critical user path.
- **Singleton Pattern**: Reuses the AWS SDK Client to optimize TCP/TLS handshake performance.

## 💰 Estimated Cost
At 100M requests/day, the AWS (eu-central-1) operational cost is estimated at **~$8.30/day**. See `architecture/ADR-001-distributed-audit-trail.md` for the full breakdown.
