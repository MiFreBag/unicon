const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

const buildTestState = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unicon-test-'));
  process.env.CONNECTION_DATA_DIR = tempDir;

  jest.resetModules();
  const { createApp, buildState } = require('../universal-server');

  return { createApp, buildState, tempDir };
};

describe('Universal server API', () => {
  let app;
  let state;

  beforeEach(() => {
    const modules = buildTestState();
    state = modules.buildState();
    app = modules.createApp(state);
  });

  test('health endpoint reports status', async () => {
    const response = await request(app).get('/unicon/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        status: 'healthy'
      })
    );
  });

  test('creates and manages connections', async () => {
    const createResponse = await request(app)
      .post('/unicon/api/connections')
      .send({ name: 'Test Connection', type: 'opcua' });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.connection).toMatchObject({
      name: 'Test Connection',
      status: 'disconnected'
    });

    const connectionId = createResponse.body.connection.id;

    const connectResponse = await request(app)
      .post('/unicon/api/connect')
      .send({ connectionId });

    expect(connectResponse.status).toBe(200);
    expect(state.connections[0].status).toBe('connected');

    const disconnectResponse = await request(app)
      .post('/unicon/api/disconnect')
      .send({ connectionId });

    expect(disconnectResponse.status).toBe(200);
    expect(state.connections[0].status).toBe('disconnected');

    const deleteResponse = await request(app).delete(`/unicon/api/connections/${connectionId}`);

    expect(deleteResponse.status).toBe(200);
    expect(state.connections).toHaveLength(0);
  });

  test('exports and imports connections', async () => {
    const createResponse = await request(app)
      .post('/unicon/api/connections')
      .send({ name: 'Import/Export', type: 'grpc' });

    expect(createResponse.status).toBe(200);

    const exportResponse = await request(app).get('/unicon/api/connections/export');

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.body.connections).toHaveLength(1);

    const importResponse = await request(app)
      .post('/unicon/api/connections/import')
      .send(exportResponse.body.connections);

    expect(importResponse.status).toBe(200);
    expect(importResponse.body.count).toBe(1);
    expect(importResponse.body.connections[0].status).toBe('disconnected');
  });
});
