const request = require('supertest');

// Set env before requiring the server module so constants pick them up
process.env.PORT = '3101';
process.env.WS_PORT = '8180';

const { startServers } = require('../universal-server');

let started;

beforeAll(async () => {
  started = await startServers();
});

afterAll(() => {
  if (started?.server) started.server.close();
  if (started?.wsServer) started.wsServer.close();
});

test('GET /unicon/api/health returns healthy', async () => {
  const agent = request(`http://localhost:${process.env.PORT}`);
  const res = await agent.get('/unicon/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('success', true);
  expect(res.body).toHaveProperty('status', 'healthy');
});

test('Connections list returns array', async () => {
  const agent = request(`http://localhost:${process.env.PORT}`);
  const res = await agent.get('/unicon/api/connections');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.connections)).toBe(true);
});