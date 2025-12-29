/* server/__tests__/csp.spa.test.js */
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { createApp, buildState } = require('../universal-server');

jest.setTimeout(20000);

describe('CSP nonce hardening for SPA HTML', () => {
  const serverDir = path.join(__dirname, '..');
  const publicDir = path.join(serverDir, 'public');
  const indexPath = path.join(publicDir, 'index.html');
  let app;

  beforeAll(async () => {
    // Ensure CSP middleware is active in tests
    process.env.ENABLE_CSP = '1';

    // Create a minimal built index.html to trigger the /unicon/* handler
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(
      indexPath,
      `<!doctype html><html><head><meta charset="utf-8"><title>Unicon</title>
      </head><body>
      <div id="root"></div>
      <script type="module" src="/unicon/assets/index.js"></script>
      </body></html>`,
      'utf8'
    );

    const state = await buildState();
    app = createApp(state);
  });

  afterAll(() => {
    try { fs.unlinkSync(indexPath); } catch (_) {}
  });

  test('GET /unicon/app sets CSP with nonce and strict-dynamic and injects nonce on scripts', async () => {
    const res = await request(app).get('/unicon/app').expect(200);
    const csp = res.headers['content-security-policy'] || '';
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    // style-src should be tightened to 'self' for SPA page
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("style-src 'self' 'unsafe-inline'");

    const body = res.text;
    // The server adds nonce to all <script> tags and injects a small inline script with the same nonce
    expect(body).toMatch(/<script[^>]*\snonce=\"[^\"]+\"/i);
    expect(body).toContain('window.__csp=1');
  });
});
