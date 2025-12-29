/* server/__tests__/csp.consent.test.js */
const request = require('supertest');
const { createApp, buildState } = require('../universal-server');

jest.setTimeout(20000);

describe('CSP on server-rendered consent pages', () => {
  let app;

  beforeAll(async () => {
    process.env.ENABLE_CSP = '1';
    process.env.GOOGLE_CLIENT_ID = 'dummy-client-id'; // allow /oauth/google/start
    const state = await buildState();
    app = createApp(state);
  });

  test('External provider start page has style nonce and no unsafe-inline', async () => {
    const res = await request(app).get('/unicon/api/oauth/google/start').expect(200);
    const csp = String(res.headers['content-security-policy'] || '');
    expect(csp).toMatch(/style-src 'self' 'nonce-[^']+'/);
    expect(csp).not.toContain("style-src 'self' 'unsafe-inline'");
    expect(res.text).toMatch(/<style\s+nonce=(['"])\S+\1/i);
  });

  test('Demo authorize page has style nonce and no unsafe-inline', async () => {
    const res = await request(app)
      .get('/unicon/api/oauth/authorize')
      .query({ client_id: 'demo', redirect_uri: 'http://localhost:3101/unicon/auth/callback', state: 's' })
      .expect(200);
    const csp = String(res.headers['content-security-policy'] || '');
    expect(csp).toMatch(/style-src 'self' 'nonce-[^']+'/);
    expect(csp).not.toContain("style-src 'self' 'unsafe-inline'");
    expect(res.text).toMatch(/<style\s+nonce=(['"])\S+\1/i);
  });
});
