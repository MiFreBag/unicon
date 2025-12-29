/* server/__tests__/oauth.demo.test.js */
const request = require('supertest');

// Import factory functions to run the app without binding a real HTTP port
const { createApp, buildState } = require('../universal-server');

jest.setTimeout(20000);

describe('Demo OAuth flow (local authorize/token) + /me', () => {
  let app;

  beforeAll(async () => {
    process.env.FEATURE_AUTH = '1'; // ensure /unicon/api/me exists and requires JWT
    const state = await buildState();
    app = createApp(state);
  });

  test('GET /unicon/api/oauth/authorize returns consent HTML', async () => {
    const redirect = 'http://localhost:3101/unicon/auth/callback';
    const res = await request(app)
      .get('/unicon/api/oauth/authorize')
      .query({ client_id: 'demo', redirect_uri: redirect, state: 'xyz' });
    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('authorize failed:', res.status, res.text);
    }
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toMatch(/Unicon Demo OAuth/);
  });

  test('Allow decision -> redirects with code; token exchange works; /me returns profile', async () => {
    const redirect = 'http://localhost:3101/unicon/auth/callback';

    // Simulate pressing Allow on consent screen
    const decision = await request(app)
      .get('/unicon/api/oauth/authorize/decision')
      .query({ client_id: 'demo', redirect_uri: redirect, state: 'abc', consent: 'allow' })
      .expect(302);

    const loc = decision.headers.location;
    expect(loc).toMatch(/\/unicon\/auth\/callback\?/);
    const codeMatch = /[?&]code=([^&]+)/.exec(loc);
    expect(codeMatch).not.toBeNull();
    const code = decodeURIComponent(codeMatch[1]);

    // Exchange the local code for a JWT
    const tokenResp = await request(app)
      .post('/unicon/api/oauth/token')
      .send({ code, client_id: 'demo' });

    if (tokenResp.status !== 200) {
      // eslint-disable-next-line no-console
      console.error('token failed:', tokenResp.status, tokenResp.body);
    }
    expect(tokenResp.status).toBe(200);
    expect(tokenResp.body).toHaveProperty('access_token');
    expect(tokenResp.body).toHaveProperty('token_type', 'Bearer');

    const jwt = tokenResp.body.access_token;

    // Call /me with the token
    const me = await request(app)
      .get('/unicon/api/me')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(me.body).toHaveProperty('success', true);
    expect(me.body).toHaveProperty('user.email', 'demo@unicon.local');
  });

  test('Deny decision -> redirects with error', async () => {
    const redirect = 'http://localhost:3101/unicon/auth/callback';
    const denial = await request(app)
      .get('/unicon/api/oauth/authorize/decision')
      .query({ client_id: 'demo', redirect_uri: redirect, state: 's1', consent: 'deny' })
      .expect(302);

    const loc = denial.headers.location;
    expect(loc).toMatch(/error=access_denied/);
  });
});
