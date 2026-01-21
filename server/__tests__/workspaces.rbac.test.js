/* server/__tests__/workspaces.rbac.test.js */
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert');

jest.setTimeout(40000);

function waitFor(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const ping = () => {
      http.get(url, res => { res.resume(); resolve(); }).on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('timeout')); else setTimeout(ping, 200);
      });
    };
    ping();
  });
}

function json(method, url, body, headers={}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + (u.search||''), method, headers: { 'Content-Type': 'application/json', 'Content-Length': data?data.length:0, ...headers } }, res => {
      let buf=''; res.on('data', c=>buf+=c); res.on('end', ()=>{
        try { resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : {} }); } catch(e) { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}

describe('Workspace RBAC', () => {
  const serverMain = path.join(__dirname, '..', 'universal-server.js');
  const baseEnv = { ...process.env, JEST_WORKER_ID: undefined };
  const PORT = '4061'; const WS = '9461';
  let child;

  beforeAll(async () => {
    const env = { ...baseEnv, NODE_ENV: 'production', FEATURE_AUTH: '1', AUTH_ENFORCE: '1', PORT, WS_PORT: WS, ENABLE_CSP: '0' };
    child = spawn(process.execPath, [serverMain], { env, stdio: ['ignore','pipe','pipe'] });
    await waitFor(`http://localhost:${PORT}/unicon/api/health`);
  });

  afterAll(() => { if (child) child.kill(); });

  function bearer(token){ return token ? { Authorization: `Bearer ${token}` } : {}; }

  test('owner can create workspace, add member, transfer ownership', async () => {
    // Login as demo owner
    const tokenRes = await json('POST', `http://localhost:${PORT}/unicon/api/oauth/token`, { code: 'dummy', client_id: 'demo' });
    // We cannot mint tokens without code; instead call local authorize flow to get a token using demo endpoint
    // For tests, fallback: call /unicon/api/oauth/authorize/decision cannot be done easily. Use /auth/login with seeded demo user.
    const login = await json('POST', `http://localhost:${PORT}/unicon/api/auth/login`, { email: 'demo@unicon.local', password: 'demo123' });
    expect(login.status).toBe(200);
    const ownerToken = login.body.token;

    // Create workspace (caller becomes owner)
    const cws = await json('POST', `http://localhost:${PORT}/unicon/api/workspaces`, { name: 'RBAC Test' }, bearer(ownerToken));
    expect(cws.status).toBe(200);
    const wid = cws.body.workspace.id;

    // Add member user2@local
    const reg = await json('POST', `http://localhost:${PORT}/unicon/api/auth/register`, { email: 'user2@local', password: 'x' });
    expect([200,409]).toContain(reg.status);
    const add = await json('POST', `http://localhost:${PORT}/unicon/api/workspaces/${wid}/members`, { userId: 'user2@local', role: 'member' }, bearer(ownerToken));
    expect(add.status).toBe(200);

    // Transfer ownership to user2
    const xfer = await json('POST', `http://localhost:${PORT}/unicon/api/workspaces/${wid}/owner-transfer`, { toUserId: 'user2@local' }, bearer(ownerToken));
    expect(xfer.status).toBe(200);

    // Login as user2 and verify list includes workspace (as owner)
    const login2 = await json('POST', `http://localhost:${PORT}/unicon/api/auth/login`, { email: 'user2@local', password: 'x' });
    expect(login2.status).toBe(200);
    const wsList = await json('GET', `http://localhost:${PORT}/unicon/api/workspaces`, null, bearer(login2.body.token));
    expect(wsList.status).toBe(200);
    const found = (wsList.body.workspaces||[]).find(w => w.id === wid);
    expect(!!found).toBe(true);
  });
});
