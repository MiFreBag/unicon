jest.setTimeout(15000);
const request = require('supertest');
const WebSocket = require('ws');
const { startServers, buildState } = require('..');

let srv;
let baseUrl;

const net = require('net');
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

beforeAll(async () => {
  process.env.PORT = process.env.PORT || String(await getFreePort());
  process.env.WS_PORT = process.env.WS_PORT || String(await getFreePort());
  srv = startServers(buildState());
  baseUrl = `http://127.0.0.1:${process.env.PORT}`;
});

afterAll((done) => {
  try {
    srv.server.close(() => done());
  } catch (e) {
    done();
  }
});

test('GET /unicon/api/health returns success', async () => {
  const res = await request(baseUrl).get('/unicon/api/health');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test('WebSocket connector can send and receive (via broadcast)', async () => {
  // Start a local echo WebSocket server
  const echoPort = await getFreePort();
  const echoServer = new WebSocket.Server({ port: echoPort, host: '127.0.0.1' });
  echoServer.on('connection', (ws) => ws.on('message', (msg) => ws.send(msg)));

  // Wait for WS readiness
  const waitReady = async () => {
    const started = Date.now();
    while (Date.now() - started < 12000) {
      try {
        const r = await request(baseUrl).get('/unicon/api/ready');
        if (r.status === 200 && r.body?.ws) break;
      } catch {}
      await new Promise(r=>setTimeout(r,200));
    }
  };
  await waitReady();
  // We will poll the last WS broadcast via HTTP instead of opening a WS client (stabilizes CI)

  // Create a websocket connection entry
  const conRes = await request(baseUrl)
    .post('/unicon/api/connections')
    .send({ name: 'ws-echo', type: 'websocket', config: { url: `ws://127.0.0.1:${echoPort}` } })
    .set('Content-Type', 'application/json');
  expect(conRes.status).toBe(200);
  const connectionId = conRes.body.connection.id;

  // Connect it
  const connRes = await request(baseUrl)
    .post('/unicon/api/connect')
    .send({ connectionId })
    .set('Content-Type', 'application/json');
  expect(connRes.status).toBe(200);

  // No WS client; we rely on server-side captured broadcast

  const expected = 'hello-ws';
  const receive = (async () => {
    const started = Date.now();
    while (Date.now() - started < 8000) {
      const r = await request(baseUrl).get('/unicon/api/test/last-ws');
      const msg = r.body?.last;
      if (msg?.type === 'ws' && msg?.data?.event === 'message' && msg?.data?.connectionId === connectionId) {
        return msg.data.data;
      }
      await new Promise(r=>setTimeout(r,200));
    }
    throw new Error('echo not received');
  })();

  const sendRes = await request(baseUrl)
    .post('/unicon/api/operation')
    .send({ connectionId, operation: 'send', params: { message: expected } })
    .set('Content-Type', 'application/json');
  expect(sendRes.status).toBe(200);

  const echoed = await receive;
  expect(echoed).toBe(expected);

  // Cleanup
  echoServer.close();
});
