const { OPCUAServer, Variant, DataType, StatusCodes } = require('node-opcua');
const net = require('net');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.setTimeout(45000);

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicon-opcua-coerce-'));
process.env.CONNECTION_DATA_DIR = tmpDir;
process.env.PERSISTENCE = 'file';
process.env.PORT = '3105';
process.env.WS_PORT = '8185';

const { startServers } = require('../universal-server');

let uaServer; let started; let api; let endpoint;

beforeAll(async () => {
  const port = await getFreePort();
  uaServer = new OPCUAServer({ port, hostname: '127.0.0.1', alternateHostname: ['127.0.0.1','localhost'] });
  await uaServer.initialize();
  const addressSpace = uaServer.engine.addressSpace;
  const namespace = addressSpace.getOwnNamespace();
  let counter = 0;
  let arr = [1,2,3];
  const obj = namespace.addObject({ organizedBy: addressSpace.rootFolder.objects, browseName: 'Dev' });
  namespace.addVariable({
    componentOf: obj,
    browseName: 'Counter',
    nodeId: 'ns=1;s=Counter',
    dataType: 'Int32',
    accessLevel: 'CurrentRead | CurrentWrite',
    userAccessLevel: 'CurrentRead | CurrentWrite',
    minimumSamplingInterval: 100,
    value: {
      get: () => new Variant({ dataType: DataType.Int32, value: counter }),
      set: (v) => { counter = v.value; return StatusCodes.Good; }
    }
  });

  namespace.addVariable({
    componentOf: obj,
    browseName: 'Array3',
    nodeId: 'ns=1;s=Array3',
    dataType: 'Int32',
    valueRank: 1,
    arrayDimensions: [3],
    accessLevel: 'CurrentRead | CurrentWrite',
    userAccessLevel: 'CurrentRead | CurrentWrite',
    minimumSamplingInterval: 100,
    value: {
      get: () => new Variant({ dataType: DataType.Int32, value: arr }),
      set: (v) => { if (!Array.isArray(v.value)) return StatusCodes.BadTypeMismatch; if (v.value.length!==3) return StatusCodes.BadTypeMismatch; arr = v.value; return StatusCodes.Good; }
    }
  });
  await uaServer.start();
  endpoint = `opc.tcp://127.0.0.1:${port}`;

  started = await startServers();
  api = request(`http://localhost:${process.env.PORT}`);
});

afterAll(async () => {
  if (started?.server) started.server.close();
  if (started?.wsServer) started.wsServer.close();
  if (uaServer) await uaServer.shutdown(500);
});

test('String numeric writes to Int32 get coerced', async () => {
  const create = await api.post('/unicon/api/connections').send({ name: 'opcua', type: 'opcua', config: { endpointUrl: endpoint } });
  expect(create.body.success).toBe(true);
  const id = create.body.connection.id;
  const con = await api.post('/unicon/api/connect').send({ connectionId: id });
  expect(con.body && con.body.success).toBe(true);

  const w = await api.post('/unicon/api/operation').send({ connectionId: id, operation: 'write', params: { nodeId: 'ns=1;s=Counter', value: '123' } });
  expect(w.body.success).toBe(true);

  const r = await api.post('/unicon/api/operation').send({ connectionId: id, operation: 'read', params: { nodes: ['ns=1;s=Counter'] } });
  expect(r.body.success).toBe(true);
  const dv = r.body.data[0];
  expect(dv.value.value).toBe(123);
});

test('Non-numeric string to Int32 fails', async () => {
  const list = await api.get('/unicon/api/connections');
  const conn = list.body.connections.find(c => c.type === 'opcua');
  const w = await api.post('/unicon/api/operation').send({ connectionId: conn.id, operation: 'write', params: { nodeId: 'ns=1;s=Counter', value: 'abc' } });
  expect(w.body.success).toBe(false);
});

test('Array rank/shape: accept [1,2,3], reject scalar and wrong length', async () => {
  const list = await api.get('/unicon/api/connections');
  const conn = list.body.connections.find(c => c.type === 'opcua');

  // Good write
  const w1 = await api.post('/unicon/api/operation').send({ connectionId: conn.id, operation: 'write', params: { nodeId: 'ns=1;s=Array3', value: [4,5,6] } });
  expect(w1.body.success).toBe(true);

  // Reject scalar
  const w2 = await api.post('/unicon/api/operation').send({ connectionId: conn.id, operation: 'write', params: { nodeId: 'ns=1;s=Array3', value: 7 } });
  expect(w2.body.success).toBe(false);

  // Reject wrong length
  const w3 = await api.post('/unicon/api/operation').send({ connectionId: conn.id, operation: 'write', params: { nodeId: 'ns=1;s=Array3', value: [1,2] } });
  expect(w3.body.success).toBe(false);
});
