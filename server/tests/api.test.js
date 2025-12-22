const request = require('supertest');
const { createApp, buildState } = require('../universal-server');

describe('Universal server API', () => {
  let app;
  let state;

  beforeEach(() => {
    state = buildState();
    app = createApp(state);
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
});
