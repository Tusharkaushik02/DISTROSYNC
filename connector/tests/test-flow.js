const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Load ERP-service app and gateway
const app = require('../../ERP-service/src/app');
const connectorGateway = require('../../ERP-service/src/modules/connector/connector.gateway');

const TEST_PORT = 4199;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const WS_URL = `ws://127.0.0.1:${TEST_PORT}/ws/connector`;

async function runTest() {
  console.log('=== RUNNING DISTROSYNC TALLY CONNECTOR INTEGRATION TEST ===\n');

  // 1. Start test HTTP & WebSocket server
  const server = http.createServer(app);
  connectorGateway.initialize(server);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[Test Server] Listening on ${BASE_URL}`);

  try {
    // 2. Test Pairing Code Generation
    console.log('\n[1] Testing Pairing Code Generation...');
    const pairCodeRes = await axios.post(`${BASE_URL}/api/v1/connector/pair-code`, {}, {
      headers: { 'x-tenant-id': 'test-tenant-12345' }
    });

    console.log('Pair Code Response:', pairCodeRes.data);
    if (!pairCodeRes.data.success || !pairCodeRes.data.data.pairingCode) {
      throw new Error('Failed to generate pairing code');
    }
    const pairingCode = pairCodeRes.data.data.pairingCode;
    console.log(`✓ Received pairing code: ${pairingCode}`);

    // 3. Test Pairing Exchange
    console.log('\n[2] Testing Pairing Code Exchange...');
    const pairExchangeRes = await axios.post(`${BASE_URL}/api/v1/connector/pair`, {
      pairingCode
    });

    console.log('Pair Exchange Response:', pairExchangeRes.data);
    if (!pairExchangeRes.data.success || !pairExchangeRes.data.data.token) {
      throw new Error('Failed to exchange pairing code for token');
    }
    const token = pairExchangeRes.data.data.token;
    console.log('✓ Received signed persistent connector token');

    // 4. Test Download Endpoint for Standalone Executable
    console.log('\n[3] Testing Download Windows Executable Endpoint...');
    const downloadRes = await axios.get(`${BASE_URL}/api/v1/connector/download/windows`, {
      responseType: 'stream'
    });

    console.log('Download Headers:', {
      'content-type': downloadRes.headers['content-type'],
      'content-disposition': downloadRes.headers['content-disposition']
    });

    if (downloadRes.status !== 200 || !downloadRes.headers['content-disposition'].includes('DistroSync-Tally-Connector.exe')) {
      throw new Error('Download endpoint did not return correct executable stream');
    }
    console.log('✓ Download endpoint successfully streamed DistroSync-Tally-Connector.exe');

    // 5. Test WebSocket Connection & Handshake
    console.log('\n[4] Testing Outbound WebSocket Connection...');
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✓ WebSocket connected successfully!');

        // Send CONNECTOR_READY
        ws.send(JSON.stringify({
          type: 'CONNECTOR_READY',
          version: '1.0.0',
          tenantId: 'test-tenant-12345',
          tallyStatus: 'ONLINE',
          companyName: 'Test Demo Distributors Pvt Ltd'
        }));
      });

      ws.on('message', async (data) => {
        const msg = JSON.parse(data.toString());
        console.log('[Test Client] Received message from gateway:', msg);

        if (msg.type === 'GATEWAY_HELLO') {
          // Verify status on REST API
          const statusRes = await axios.get(`${BASE_URL}/api/v1/connector/status`, {
            headers: { 'x-tenant-id': 'test-tenant-12345' }
          });
          console.log('[REST Status] Current connector status:', statusRes.data);
          if (statusRes.data.data.status !== 'CONNECTED') {
            return reject(new Error('Connector status should be CONNECTED'));
          }

          // Test dispatching a job from cloud to connector
          console.log('\n[5] Testing Cloud Job Dispatch & Response...');
          setTimeout(async () => {
            try {
              const syncPromise = axios.post(`${BASE_URL}/api/v1/connector/sync`, {
                action: 'PING_TALLY'
              }, {
                headers: { 'x-tenant-id': 'test-tenant-12345' }
              });

              // The WS client listens for the job
            } catch (e) {
              reject(e);
            }
          }, 100);
        }

        if (msg.type === 'EXECUTE_JOB') {
          console.log(`[Test Client] Simulating job execution: ${msg.action} (${msg.jobId})`);
          // Respond with mock job completion
          ws.send(JSON.stringify({
            type: 'JOB_RESULT',
            jobId: msg.jobId,
            success: true,
            data: {
              online: true,
              companyName: 'Test Demo Distributors Pvt Ltd',
              tallyPort: 9000
            }
          }));
          console.log('✓ Sent JOB_RESULT back to cloud');
          resolve();
        }
      });

      ws.on('error', reject);
    });

    console.log('\n✓ ALL TESTS PASSED SUCCESSFULLY!\n');
    ws.close();
  } finally {
    server.close();
  }
}

runTest().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
