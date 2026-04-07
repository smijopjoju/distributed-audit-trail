import autocannon from 'autocannon';
import { execSync, spawn } from 'child_process';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const DURATION = 60; // 60 seconds for full load test
const CONNECTIONS = 100; // Lower connections for local stability
const RPS_LIMIT = 5000; // Target RPS for production-grade verification
const URL = 'http://localhost:3000/graphql';

const LOG_FILE = path.join(__dirname, 'server.log');

const token = jwt.sign({ sub: 'perf-user', permissions: ['TRADE'], mfa_verified: true }, 'secret');

async function runTest(name: string, disableAudit: boolean) {
  console.log(`\n🚀 Starting ${name} Test (Duration: ${DURATION}s, Target: ${RPS_LIMIT} RPS)`);
  
  // Clear or initialize log file
  fs.appendFileSync(LOG_FILE, `\n\n--- STARTING TEST: ${name} ---\n`);

  // 1. Start the server in a subprocess
  // Using direct ts-node call instead of npm start to avoid shell pipe issues on Windows
  const server = spawn('npx', ['ts-node', path.resolve(__dirname, '../audit-service/src/index.ts')], {
    cwd: path.resolve(__dirname, '../audit-service'),
    env: { ...process.env, DISABLE_AUDIT: String(disableAudit), PORT: '3000', NODE_ENV: 'test' },
    shell: true
  });

  // Pipe server output to log file
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  server.stdout?.pipe(logStream);
  server.stderr?.pipe(logStream);

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 2. Run Autocannon
  const result = await autocannon({
    url: URL,
    connections: CONNECTIONS,
    duration: DURATION,
    overallRate: RPS_LIMIT,
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      operationName: 'placeOrder',
      variables: {
        portfolioId: 'p1',
        input: { isin: 'DE001', side: 'BUY', numberOfShares: 100 }
      }
    }),
    method: 'POST'
  });

  // 3. Cleanup Server
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /F /T /PID ${server.pid}`, { stdio: 'ignore' });
    } catch (e) {}
  } else {
    server.kill();
  }

  logStream.end();
  return result;
}

function printSummary(name: string, result: autocannon.Result) {
  const latency = (result.latency as any) || {};
  console.log(`\n--- ${name} RESULTS ---`);
  console.log(`Requests/sec: ${result.requests?.average?.toFixed(2) || '0.00'}`);
  console.log(`Throughput:   ${((result.throughput?.average || 0) / 1024 / 1024).toFixed(2)} MB/s`);
  console.log(`Latency P50:  ${latency.p50?.toFixed(2) || '0.00'} ms`);
  console.log(`Latency P95:  ${latency.p95?.toFixed(2) || '0.00'} ms`);
  console.log(`Latency P99:  ${latency.p99?.toFixed(2) || '0.00'} ms`);
  console.log(`Errors:       ${result.errors}`);
  console.log(`Non-2xx:     ${result.non2xx}`);
}

async function main() {
  try {
    const baseline = await runTest('Baseline (No Audit)', true);
    printSummary('BASELINE', baseline);

    const audited = await runTest('Audited (Sync Kinesis)', false);
    printSummary('AUDITED', audited);

    const bReq = baseline.requests?.average || 0;
    const aReq = audited.requests?.average || 0;
    
    const bLatency = (baseline.latency as any) || { p95: 0, p99: 0 };
    const aLatency = (audited.latency as any) || { p95: 0, p99: 0 };

    console.log('\n📊 PERFORMANCE COMPARISON');
    console.log('-------------------------');
    console.log(`Metric      | Baseline   | Audited    | Delta %`);
    console.log(`Req/Sec     | ${bReq.toFixed(0).padEnd(10)} | ${aReq.toFixed(0).padEnd(10)} | ${bReq ? ((aReq / bReq - 1) * 100).toFixed(2) : 0}%`);
    console.log(`P99 Latency | ${bLatency.p99?.toFixed(2).padEnd(10)} | ${aLatency.p99?.toFixed(2).padEnd(10)} | ${bLatency.p99 ? ((aLatency.p99 / bLatency.p99 - 1) * 100).toFixed(2) : 0}%`);

    if (aLatency.p99 < 110) {
      console.log('\n✅ PERFORMANCE SLA MET: P99 < 110ms');
    } else {
      console.log('\n❌ PERFORMANCE SLA FAILED: P99 > 110ms');
    }
  } catch (err) {
    console.error('Performance test failed:', err);
  }
}

main();
