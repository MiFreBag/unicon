/* server/__tests__/auth.enforce.test.js */
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

jest.setTimeout(30000);

function waitForServer(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function ping() {
      http.get(url, res => { res.resume(); resolve(); }).on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('timeout'));
        else setTimeout(ping, 200);
      });
    }
    ping();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

describe('AUTH_ENFORCE default-on when FEATURE_AUTH=1 (outside Jest env)', () => {
  const serverMain = path.join(__dirname, '..', 'universal-server.js');
  const baseEnv = { ...process.env, JEST_WORKER_ID: undefined };

  test('defaults to 401 without token when FEATURE_AUTH=1 and AUTH_ENFORCE not set', async () => {
    const env = { ...baseEnv, NODE_ENV: 'production', FEATURE_AUTH: '1', PORT: '4051', WS_PORT: '9451', ENABLE_CSP: '0' };
    const child = spawn(process.execPath, [serverMain], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await waitForServer('http://localhost:4051/unicon/api/health');
      // /me is always protected when FEATURE_AUTH=1; should return 401 w/o token
      const r = await get('http://localhost:4051/unicon/api/me');
      expect(r.status).toBe(401);
    } finally {
      child.kill();
    }
  });

  test('returns 200 when AUTH_ENFORCE=0 explicitly disables enforcement', async () => {
    const env = { ...baseEnv, NODE_ENV: 'production', FEATURE_AUTH: '1', AUTH_ENFORCE: '0', PORT: '4052', WS_PORT: '9452', ENABLE_CSP: '0' };
    const child = spawn(process.execPath, [serverMain], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await waitForServer('http://localhost:4052/unicon/api/health');
      // With AUTH_ENFORCE=0, unprotected routes like /connections should be accessible
      const r1 = await get('http://localhost:4052/unicon/api/connections');
      expect(r1.status).toBe(200);
      // /me remains protected; still 401
      const r2 = await get('http://localhost:4052/unicon/api/me');
      expect(r2.status).toBe(401);
    } finally {
      child.kill();
    }
  });
});
