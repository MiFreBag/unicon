const request = require('supertest');
const WebSocket = require('ws');
const { startServers, buildState } = require('..');

let srv;
let baseUrl;

beforeAll(() => {
  // Use ports from package.json test script or defaults
  process.env.PORT = process.env.PORT || '3101';
  process.env.WS_PORT = process.env.WS_PORT || '8180';
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
  const echoPort = 9099;
  const echoServer = new WebSocket.Server({ port: echoPort });
  echoServer.on('connection', (ws) => ws.on('message', (msg) => ws.send(msg)));

  // Subscribe to app’s broadcast WS to capture messages from connector
  const appWsUrl = `ws://127.0.0.1:${process.env.WS_PORT}`;
  const broadcastClient = new WebSocket(appWsUrl);

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

  // Wait for broadcast open, then send and await echo
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('broadcast ws open timeout')), 5000);
    broadcastClient.once('open', () => { clearTimeout(timer); resolve(); });
  });

  const expected = 'hello-ws';
  const receive = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('echo not received')), 8000);
    broadcastClient.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'ws' && msg?.data?.event === 'message' && msg?.data?.connectionId === connectionId) {
          clearTimeout(timer);
          resolve(msg.data.data);
        }
      } catch (_) {}
    });
  });

  const sendRes = await request(baseUrl)
    .post('/unicon/api/operation')
    .send({ connectionId, operation: 'send', params: { message: expected } })
    .set('Content-Type', 'application/json');
  expect(sendRes.status).toBe(200);

  const echoed = await receive;
  expect(echoed).toBe(expected);

  // Cleanup
  broadcastClient.close();
  echoServer.close();
});
