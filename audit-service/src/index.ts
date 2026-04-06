import express from 'express';
import { auditInterceptor } from './middleware/AuditInterceptor';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Apply the Audit Interceptor to all GraphQL requests
app.post('/graphql', auditInterceptor, (req, res) => {
  console.log(`[SERVER] Processing GraphQL Operation: ${req.body?.operationName}`);
  res.json({
    data: {
      message: "Operation successful",
      operation: req.body?.operationName
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Audit Reference Implementation running at http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'local'} (Using ${process.env.NODE_ENV === 'production' ? 'AWS Kinesis' : 'MockKinesisProducer'})`);
});
