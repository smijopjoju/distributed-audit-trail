import express from 'express';
import { auditInterceptor } from './middleware/AuditInterceptor';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Apply the Audit Interceptor unless disabled for baseline testing
if (process.env.DISABLE_AUDIT === 'true') {
  console.log('⚠️  AUDIT DISABLED (Baseline Mode)');
  app.post('/graphql', (req, res) => {
    res.json({ data: { message: "Operation successful" } });
  });
} else {
  console.log('⚠️  AUDIT Enabled (Audit Mode)');
  app.post('/graphql', auditInterceptor, (req, res) => {
    res.json({ data: { message: "Operation successful" } });
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Audit Reference Implementation running at http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'local'} (Using ${process.env.NODE_ENV === 'production' ? 'AWS Kinesis' : 'MockKinesisProducer'})`);
});
