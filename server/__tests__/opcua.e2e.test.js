const { OPCUAServer, Variant, DataType, StatusCodes } = require('node-opcua');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('supertest');

jest.setTimeout(60000);

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

// Use isolated data dir and dedicated ports for this suite
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicon-opcua-'));
process.env.CONNECTION_DATA_DIR = tmpDir;
process.env.PERSISTENCE = 'file';
process.env.PORT = '3104';
process.env.WS_PORT = '8184';

const { startServers } = require('../universal-server');

let uaServer; let uaEndpoint; let started; let api;

beforeAll(async () => {
  const port = await getFreePort();
  uaServer = new OPCUAServer({
    port,
    hostname: '127.0.0.1',
    alternateHostname: ['127.0.0.1','localhost'],
    buildInfo: { productName: 'UniconTestOPCUA', buildNumber: '1', buildDate: new Date() },
  });
  await uaServer.initialize();
  // Optional: create a custom variable
  const addressSpace = uaServer.engine.addressSpace;
  const namespace = addressSpace.getOwnNamespace();
  const device = namespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: 'TestDevice',
  });
  let counter = 42;
  namespace.addVariable({
    componentOf: device,
    browseName: 'Counter',
    nodeId: 'ns=1;s=Counter',
    dataType: 'Int32',
    accessLevel: 'CurrentRead | CurrentWrite',
    userAccessLevel: 'CurrentRead | CurrentWrite',
    minimumSamplingInterval: 100,
    value: {
      get: () => new Variant({ dataType: DataType.Int32, value: counter }),
      set: (variant) => {
        counter = variant.value;
        return StatusCodes.Good;
      }
    },
    minimumSamplingInterval: 100
  });

  await uaServer.start();
  uaEndpoint = `opc.tcp://127.0.0.1:${port}`;

  started = await startServers();
  api = request(`http://localhost:${process.env.PORT}`);
});

afterAll(async () => {
  if (started?.server) started.server.close();
  if (started?.wsServer) started.wsServer.close();
  if (uaServer) await uaServer.shutdown(1000);
});

test('OPC UA: connect and browse RootFolder', async () => {
  // Create connection
  const create = await api.post('/unicon/api/connections').send({
    name: 'opcua-local',
    type: 'opcua',
    config: { endpointUrl: uaEndpoint }
  });
  expect(create.body.success).toBe(true);
  const id = create.body.connection.id;

  // Connect
  const con = await api.post('/unicon/api/connect').send({ connectionId: id });
  expect(con.body.success).toBe(true);

  // Browse
  const browse = await api.post('/unicon/api/operation').send({
    connectionId: id,
    operation: 'browse',
    params: { nodeId: 'RootFolder' }
  });
  expect(browse.body.success).toBe(true);
  expect(Array.isArray(browse.body.data)).toBe(true);
  expect(browse.body.data.length).toBeGreaterThan(0);
});

test('OPC UA: write/read custom variable', async () => {
  const list = await api.get('/unicon/api/connections');
  const conn = list.body.connections.find(c => c.type === 'opcua');
  expect(conn).toBeTruthy();

  // Write a new value
  const write = await api.post('/unicon/api/operation').send({
    connectionId: conn.id,
    operation: 'write',
    params: { nodeId: 'ns=1;s=Counter', value: 99, dataType: 'Int32' }
  });
  expect(write.body.success).toBe(true);

  // Read it back
  const readBack = await api.post('/unicon/api/operation').send({
    connectionId: conn.id,
    operation: 'read',
    params: { nodes: ['ns=1;s=Counter'] }
  });
  expect(readBack.body.success).toBe(true);
  expect(Array.isArray(readBack.body.data)).toBe(true);
  const dv = readBack.body.data[0];
  expect(typeof dv.value?.value === 'number').toBe(true);
});

test('OPC UA: read standard node ServerStatus.CurrentTime', async () => {
  const list = await api.get('/unicon/api/connections');
  const conn = list.body.connections.find(c => c.type === 'opcua');
  expect(conn).toBeTruthy();

  const read = await api.post('/unicon/api/operation').send({
    connectionId: conn.id,
    operation: 'read',
    params: { nodes: ['ns=0;i=2258'] }
  });
  expect(read.body.success).toBe(true);
  expect(Array.isArray(read.body.data)).toBe(true);
  expect(read.body.data.length).toBe(1);
});