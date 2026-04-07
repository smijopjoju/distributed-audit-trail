# Distributed Audit & Forensic Logging System

## 📌 Overview
This repository contains the architecture design and reference implementation for a centralized **Audit Trail System**. The system is engineered to handle **100 million requests per day** (~5,000 RPS peak) while ensuring absolute forensic integrity and real-time security alerting.

## 🏗️ System Architecture
The solution utilizes a **Decoupled Processing Pipeline** to ensure that sensitive data is stripped and anonymized before it ever reaches permanent storage.

### Key Components:
1. **Extraction (GraphQL Interceptor):** A TypeScript middleware that extracts operation metadata, user permissions from JWTs, and identifiers (e.g., UserID, IP, Device ID).
2. **Buffering (Amazon Kinesis):** A high-throughput stream that captures raw events with a **Synchronous Broker Acknowledgement** to prevent data loss.
3. **Anonymization Consumer (AWS Lambda/Data Firehose):** This layer acts as the **PII Filter**. It identifies and strips or anonymizes PII—including IP addresses—before the data is persisted.
4. **Immutable Storage (Amazon S3):** Events are written to S3 using **Object Lock (Compliance Mode)** to ensure they are tamper-proof and forensic-ready.
5. **SOC Review & Alerting (Amazon Athena):** The primary component for log review. It allows the SOC team to write SQL-based rules to trigger alerts (e.g., detecting unauthorized withdrawals or missing MFA).

## 🛡️ Forensic & Privacy Strategy
### 1. Forensic Data Retention (The Allow-list)
To support the SOC team in real-time alerting and incident response, the system utilizes an **Allow-list** approach for data capture.
- **Retained Identifiers:** We record `user_id`, `ip_address`, and `device_id`. These are critical for identifying the origin of attacks and unauthorized access.
- **Strict Masking:** Any data field (e.g., within GraphQL arguments) not explicitly defined in the security allow-list is automatically masked before persistence. Direct PII such as names, emails, or physical addresses are never recorded.

### 2. Compliance & The "Right to be Forgotten"
Our architecture satisfies GDPR requirements through **Identity Dissociation**:
- **Immutable Logs:** Audit logs are stored in WORM (Write Once Read Many) storage and cannot be altered.
- **Anonymization by Deletion:** Upon a deletion request, the mapping of `user_id` to a natural person is removed from the production identity service. The audit trail remains intact for regulatory compliance, but the `user_id` becomes an anonymous surrogate key with no link to a specific individual.

## 🚀 Performance & Scalability
The system is designed for high-concurrency environments using an **N+1 stateless architecture**.
- **Latency Budget:** These figures represent the added latency to every GraphQL request:

| Metric | Target (ms) | Confidence | Technical Context |
| :--- | :--- | :--- | :--- |
| **$P50$ (Median)** | 18ms – 22ms | High | Typical network round-trip + 1ms processing. |
| **$P95$** | 35ms – 45ms | High | Includes minor cross-AZ jitter. |
| **$P99$** | 75ms – 110ms | Medium | The "Tail Latency" caused by Kinesis 3-AZ replication. |

- **Horizontal Scaling:** Deployed on AWS ECS Fargate, the fleet scales based on throughput, ensuring the audit trail does not become a bottleneck.

## 📂 Project Structure
```text
.
├── architecture/           # ADR-001 (Design Decisions) & C4 Diagrams
├── audit-service/          # TypeScript Reference Implementation
│   ├── src/
│   │   ├── middleware/     # Interceptor (Extraction Logic)
│   │   ├── consumer/       # Anonymization & Stripping Logic
│   │   └── services/       # Kinesis Producer
├── performance/            # Load testing scripts (k6/Autocannon) & Reports
└── docs/                   # AI Usage Disclosure & Forensic Strategy
```

## 💰 Cost Efficiency (AWS eu-central-1)
Calculated for **100 million requests/day** with an average event size of 1 KB (~100 GB/day).

| Service | Basis of Calculation | Est. Daily Cost |
| :--- | :--- | :--- |
| **Amazon Kinesis** | 6 Shards ($0.0179/hr) + 100M PUT Units ($0.0165/1M) | $4.23 |
| **Amazon Data Firehose** | Data ingestion and processing ($0.031/GB) | $3.10 |
| **AWS Lambda** | ~200k batched invocations + duration (128MB RAM) | $0.35 |
| **Amazon S3** | 100 GB storage + PUT requests + Object Lock overhead | $0.12 |
| **Amazon Athena** | SOC query scans (~100GB scanned daily at $5/TB) | $0.50 |
| **Total** | **Daily Operational Base Cost** | **~$8.30** |
