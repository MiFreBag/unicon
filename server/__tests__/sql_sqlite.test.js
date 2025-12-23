const request = require('supertest');
const { startServers, buildState } = require('..');

let srv;
let baseUrl;

beforeAll(() => {
  process.env.PORT = process.env.PORT || '3102';
  process.env.WS_PORT = process.env.WS_PORT || '8181';
  srv = startServers(buildState());
  baseUrl = `http://127.0.0.1:${process.env.PORT}`;
});

afterAll((done) => {
  try { srv.server.close(() => done()); } catch { done(); }
});

test('sqlite :memory: create/insert/select', async () => {
  // Create SQL connection
  const createRes = await request(baseUrl)
    .post('/unicon/api/connections')
    .send({ name: 'mem-sqlite', type: 'sql', config: { driver: 'sqlite', filename: ':memory:' } })
    .set('Content-Type', 'application/json');
  expect(createRes.status).toBe(200);
  const connectionId = createRes.body.connection.id;

  // Connect
  const connectRes = await request(baseUrl)
    .post('/unicon/api/connect')
    .send({ connectionId })
    .set('Content-Type', 'application/json');
  expect(connectRes.status).toBe(200);

  // Create table
  let opRes = await request(baseUrl)
    .post('/unicon/api/operation')
    .send({ connectionId, operation: 'query', params: { sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)' } })
    .set('Content-Type', 'application/json');
  expect(opRes.status).toBe(200);

  // Insert
  opRes = await request(baseUrl)
    .post('/unicon/api/operation')
    .send({ connectionId, operation: 'query', params: { sql: 'INSERT INTO t (name) VALUES (?)', params: ['alice'] } })
    .set('Content-Type', 'application/json');
  expect(opRes.status).toBe(200);

  // Select
  opRes = await request(baseUrl)
    .post('/unicon/api/operation')
    .send({ connectionId, operation: 'query', params: { sql: 'SELECT * FROM t' } })
    .set('Content-Type', 'application/json');
  expect(opRes.status).toBe(200);
  expect(Array.isArray(opRes.body.data.rows) || Array.isArray(opRes.body.rows)).toBe(true);
  const rows = opRes.body.data?.rows || opRes.body.rows;
  expect(rows.length).toBe(1);
  expect(rows[0].name).toBe('alice');
});
