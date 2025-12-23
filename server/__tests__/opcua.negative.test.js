const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.setTimeout(15000);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicon-opcua-neg-'));
process.env.CONNECTION_DATA_DIR = tmpDir;
process.env.PERSISTENCE = 'file';
process.env.PORT = '3110';
process.env.WS_PORT = '8190';

const { startServers } = require('../universal-server');

let started; let api;

beforeAll(async () => {
  started = await startServers();
  api = request(`http://localhost:${process.env.PORT}`);
});

afterAll(() => {
  if (started?.server) started.server.close();
  if (started?.wsServer) started.wsServer.close();
});

test('OPC UA connect fails for bad endpoint', async () => {
  const create = await api.post('/unicon/api/connections').send({
    name: 'opcua-bad',
    type: 'opcua',
    config: { endpointUrl: 'opc.tcp://127.0.0.1:1', timeoutMs: 1000 }
  });
  expect(create.body.success).toBe(true);
  const id = create.body.connection.id;

  const con = await api.post('/unicon/api/connect').send({ connectionId: id });
  expect(con.status).toBeGreaterThanOrEqual(400);
  expect(con.body.success).toBe(false);
});

test('OPC UA connect times out for unreachable host', async () => {
  const create = await api.post('/unicon/api/connections').send({
    name: 'opcua-timeout',
    type: 'opcua',
    config: { endpointUrl: 'opc.tcp://192.0.2.1:4840', timeoutMs: 1000 } // 192.0.2.0/24 TEST-NET-1
  });
  expect(create.body.success).toBe(true);
  const id = create.body.connection.id;
  const con = await api.post('/unicon/api/connect').send({ connectionId: id });
  expect(con.status).toBeGreaterThanOrEqual(400);
  expect(con.body.success).toBe(false);
});