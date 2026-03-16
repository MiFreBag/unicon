# Problem statement
Stabilize and validate the backend in `server/` by triaging any current failures in the Jest E2E/unit suite, addressing defects in API/WebSocket/auth/RBAC flows, and ensuring a reliable local workflow to run tests on Windows (PowerShell). Do not modify client/desktop in this pass beyond what’s needed for backend tests.
## Current state (from repo research, no assumptions)
* Tech stack: Node.js (Express + ws), optional Node-RED embed, Jest + Supertest for tests. Entry point is `server/universal-server.js`. Exports `{ startServers, buildState, createApp }` (server/universal-server.js:2657-2663). Workspace repo with `workspaces: [client, server, desktop]`.
* Data layer: file-backed JSON by default; optional SQLite via `PERSISTENCE=sqlite` (`server/universal-server.js:148-166`, `server/persistence/db.js`).
* Auth: optional, gated by `FEATURE_AUTH=1`; enforcement toggled by `AUTH_ENFORCE=1` (routes still individually guarded for sensitive endpoints). Auth router exists at `server/auth/router.js`. JWT helpers in `server/auth/middleware.js`.
* WebSocket: standalone WS server via `createWebSocketServer`; readiness flag `__WS_READY` exposed in `/unicon/api/ready` (server/universal-server.js:2493-2510, 721-725). Broadcast helper stores last WS message for tests at `/unicon/api/test/last-ws` (202-210, 727-730).
* CSP: Production/Electron CSP headers added for `/unicon/*`; SPA HTML response tightens CSP and injects a per-response nonce (server/universal-server.js:335-372, 2457-2479). Tests live in `server/__tests__/csp.*.test.js`.
* Tests: Jest config used by npm test is `server/jest.config.js` with `testMatch: **/__tests__/**/*.test.js`. Suites include WebSocket echo, auth enforcement (spawned server), RBAC with auth, OPC UA/SSH/SQL/NTCIP handlers, k8s, REST E2E.
* Notable repo findings:
    * Root `package.json` script `"server": "node server/index.js"` points to a non-existent file; actual entry is `server/universal-server.js`.
    * `server/__tests__/health_ws.test.js` uses `/unicon/api/ready` and the last-WS helper; it also spins a local echo WS on port 9099.
    * Node-RED embed is explicitly disabled in tests (`IN_TEST_NODERED` logic) to avoid port noise.
    * Uncommitted changes touch backend code and tests (e.g., `server/universal-server.js`, `server/handlers/ws_handler.js`, `server/__tests__/health_ws.test.js`).
## Research-backed likely areas to verify first
* WebSocket readiness/broadcast path used by `health_ws.test.js` (ready flag, last broadcast, send path in `handlers/ws_handler.js`).
* Auth enforcement defaults for protected vs unprotected endpoints under various env toggles (`FEATURE_AUTH`, `AUTH_ENFORCE`) exercised by `auth.enforce.test.js`.
* RBAC workspace endpoints relying on file-mode fallback when SQLite is not used (routes around `workspaces` and `workspace_members` in server/universal-server.js; file-mode helpers at 167-186, 167-181; DB methods in `server/persistence/db.js`).
* Root script mismatch (`server/index.js` vs actual entry) that can confuse local developers and CI scripts that rely on `npm run server` from repo root.
## Plan of action
1) Prepare environment
* Use Node 18+ (repo asks for Node >=16). Ensure clean install in the server workspace only to keep scope contained: `npm ci --prefix server`.
* Ensure ports 3101/8180, 4051/9451, 4052/9452, 4061/9461 are free (used by tests that spawn servers). If conflicts arise locally, temporarily adjust test envs per suite while keeping semantics.
2) Reproduce and triage test outcomes (no code changes yet)
* Run backend tests only: `npm --prefix server run test`. Capture failing spec names and messages.
* Group failures by domain (WS readiness/broadcast, CSP headers, auth/RBAC, protocol handlers), link each to concrete routes/paths in `server/universal-server.js` and handler files.
3) Targeted fixes (scoped, minimal)
* WS readiness/broadcast
    * If `/unicon/api/ready` reports `ws: false` too early: verify `__WS_READY` set path in `createWebSocketServer` and when it’s flipped (setImmediate after listen in non-TLS branch). Adjust readiness check or initialization ordering if needed.
    * If echo test intermittently fails: inspect `handlers/ws_handler.js` pre/post/retry broadcasts and server-side router echo path (`/unicon/api/operation` → `websocket/send`). Tweak retry/backoff thresholds conservatively to stabilize without over-broadcasting.
* CSP hardening
    * If SPA CSP test fails: verify CSP middleware runs before `/unicon/*` handler and that `script-src` gets `'nonce-...' 'strict-dynamic'` and `style-src 'self'` replacements. Fix header composition order only (no broad CSP policy changes).
    * If consent pages lack a style nonce: ensure response header mutation precedes HTML send and is active when `ENABLE_CSP=1`.
* Auth/RBAC
    * If `auth.enforce.*` or RBAC tests fail: confirm ENFORCE logic (`IN_TEST` detection; per-route guards) and file-mode fallbacks for workspace/member endpoints (server/universal-server.js:167-186, 1498-1575). Patch route guards narrowly to meet test expectations without relaxing defaults in production mode.
* Root developer UX
    * Fix root `package.json` "server" script to invoke `node server/universal-server.js` to match the actual entry. No behavioral change to tests; improves local/CI ergonomics.
4) Validation
* Re-run `npm --prefix server test` until green.
* Optional: run a minimal manual smoke check of `/unicon/api/health`, `/unicon/api/ready`, and a simple REST connection op with Supertest or curl against the started test server.
5) Documentation
* Add a short backend-focused doc note under `docs/` describing how to run tests, ports used, and the auth/WS/CSP toggles relevant to tests.
## Risks and unknowns
* External protocol handler suites (OPCUA/NTCIP/gRPC/SQL) may rely on optional binaries/services. Tests in repo appear to exercise in-process stubs/mocks, but if any suite expects external services, we’ll need to locally skip or provide minimal fixtures.
* Windows networking/port reuse can cause flakiness for spawned servers; readiness waits in tests already poll endpoints—may still require slight timing adjustments if failures reproduce.
## Acceptance criteria
* `npm --prefix server run test` passes locally with consistent results on Windows PowerShell.
* No regressions in CSP/auth/RBAC semantics versus current tests.
* Root `npm run server` script points to the working entry file.
* Minimal doc note exists describing how to run and troubleshoot backend tests.
