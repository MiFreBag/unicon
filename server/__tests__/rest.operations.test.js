const express = require('express');
const http = require('http');
const request = require('supertest');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Increase timeout for server spin-up
jest.setTimeout(20000);

// Use a temp data dir per run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicon-rest-'));
process.env.CONNECTION_DATA_DIR = tmpDir;
process.env.PERSISTENCE = 'file';
process.env.PORT = '3102';
process.env.WS_PORT = '8182';

const { startServers } = require('../universal-server');

let started; let api; let demoServer; let demoPort;

beforeAll(async () => {
  // Start demo REST backend
  const app = express();
  app.get('/test', (req, res) => res.json({ ok: true }));
  app.get('/hello/:name', (req, res) => res.json({ message: `Hello ${req.params.name}` }));
  demoServer = http.createServer(app);
  await new Promise(resolve => demoServer.listen(0, '127.0.0.1', resolve));
  demoPort = demoServer.address().port;

  // Start Unicon server
  started = await startServers();
  api = request(`http://localhost:${process.env.PORT}`);
});

afterAll(async () => {
  if (started?.server) started.server.close();
  if (started?.wsServer) started.wsServer.close();
  if (demoServer) demoServer.close();
});

test('REST: connect and perform GET /test via /operation', async () => {
  // Create connection
  const create = await api.post('/unicon/api/connections').send({
    name: 'rest-local',
    type: 'rest',
    config: { baseUrl: `http://127.0.0.1:${demoPort}` }
  });
  expect(create.body.success).toBe(true);
  const id = create.body.connection.id;

  // Connect
  const con = await api.post('/unicon/api/connect').send({ connectionId: id });
  expect(con.body.success).toBe(true);

  // Request operation
  const op = await api.post('/unicon/api/operation').send({
    connectionId: id,
    operation: 'request',
    params: { method: 'GET', endpoint: '/test' }
  });
  expect(op.body.success).toBe(true);
  expect(op.body.data.status).toBe(200);
  expect(op.body.data.data).toEqual({ ok: true });
});

test('REST: upload OpenAPI, load, and generate example/validate', async () => {
  const openapi = {
    openapi: '3.0.0',
    info: { title: 'Demo', version: '1.0.0' },
    paths: {
      '/hello/{name}': {
        get: {
          summary: 'Say hello',
          parameters: [
            { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'x-req-id', in: 'header', required: false, schema: { type: 'string' } }
          ],
          responses: { '200': { description: 'ok' } }
        }
      }
    }
  };

  // Get a REST connection
  const list = await api.get('/unicon/api/connections');
  const rest = list.body.connections.find(c => c.type === 'rest');
  expect(rest).toBeTruthy();

  // Upload spec
  const upload = await api
    .post('/unicon/api/upload-openapi')
    .attach('openApiFile', Buffer.from(JSON.stringify(openapi)), 'demo.json');
  expect(upload.body.success).toBe(true);

  // Load spec into handler
  const load = await api.post('/unicon/api/operation').send({
    connectionId: rest.id,
    operation: 'loadOpenApi',
    params: { openApiFile: 'demo.json' }
  });
  expect(load.body.success).toBe(true);

  // Get endpoints
  const eps = await api.post('/unicon/api/operation').send({
    connectionId: rest.id,
    operation: 'getEndpoints',
    params: {}
  });
  expect(eps.body.success).toBe(true);
  expect(Array.isArray(eps.body.data.endpoints)).toBe(true);

  // Generate example
  const ex = await api.post('/unicon/api/operation').send({
    connectionId: rest.id,
    operation: 'generateExample',
    params: { path: '/hello/{name}', method: 'GET' }
  });
  expect(ex.body.success).toBe(true);
  expect(ex.body.data.path).toContain('/hello/');

  // Validate missing param -> error
  const val = await api.post('/unicon/api/operation').send({
    connectionId: rest.id,
    operation: 'validateRequest',
    params: { path: '/hello/{name}', method: 'GET', headers: {}, params: {} }
  });
  expect(val.body.success).toBe(true);
  expect(val.body.data.valid).toBe(false);
});