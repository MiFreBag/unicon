const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const request = require('supertest');
const fs = require('fs');
const os = require('os');

jest.setTimeout(30000);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicon-grpc-'));
process.env.CONNECTION_DATA_DIR = tmpDir;
process.env.PERSISTENCE = 'file';
process.env.PORT = '3103';
process.env.WS_PORT = '8183';

const { startServers } = require('../universal-server');

let server; let started; let api; let address;

function startGrpcServer() {
  const protoPath = path.join(__dirname, '..', 'proto', 'test.proto');
  const defs = grpc.loadPackageDefinition(protoLoader.loadSync(protoPath, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }));
  const testPkg = defs.test;

  const svc = {
    Say: (call, cb) => cb(null, { message: `Hello ${call.request.name}` })
  };

  const s = new grpc.Server();
  s.addService(testPkg.Echo.service, svc);
  return new Promise(resolve => {
    s.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) throw err;
      s.start();
      resolve({ server: s, port });
    });
  });
}

beforeAll(async () => {
  const { server: s, port } = await startGrpcServer();
  server = s;
  address = `127.0.0.1:${port}`;
  started = await startServers();
  api = request(`http://localhost:${process.env.PORT}`);
});

afterAll(() => {
  if (started?.server) started.server.close();
  if (started?.wsServer) started.wsServer.close();
  if (server) server.forceShutdown();
});

test('gRPC: connect and unary call via /operation', async () => {
  // write proto if not present
  // (created by repo patch)
  const create = await api.post('/unicon/api/connections').send({
    name: 'grpc-local',
    type: 'grpc',
    config: {
      address,
      proto: 'test.proto',
      package: 'test',
      service: 'Echo'
    }
  });
  expect(create.body.success).toBe(true);
  const id = create.body.connection.id;

  const con = await api.post('/unicon/api/connect').send({ connectionId: id });
  expect(con.body.success).toBe(true);

  const op = await api.post('/unicon/api/operation').send({
    connectionId: id,
    operation: 'unary',
    params: { method: 'Say', request: { name: 'World' } }
  });

  expect(op.body.success).toBe(true);
  expect(op.body.data).toEqual({ message: 'Hello World' });
});