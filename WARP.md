# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

All commands below assume npm workspaces with two packages: `client` (React + Vite) and `server` (Express + ws). Prefer running scripts from the repo root unless noted.

- Install dependencies (root + workspaces)
  - `npm install`
- Run frontend and backend together (dev)
  - `npm run dev:all`
- Frontend only (Vite dev server on http://localhost:5174)
  - `npm --prefix client run dev`
- Backend only (HTTP on PORT, default 3001; WebSocket on WS_PORT, default 8080)
  - `npm --prefix server run dev`
  - Production start
    - `npm --prefix server run start`
- Lint/format (frontend)
  - Lint: `npm --prefix client run lint`
  - Auto-fix: `npm --prefix client run lint:fix`
  - Format: `npm --prefix client run format`
- Build/preview (frontend)
  - Build: `npm --prefix client run build`
  - Preview built assets: `npm --prefix client run preview`

Notes
- Tests are not configured in this repo (no test scripts in `client`; `server`’s `npm test` is a placeholder). If you add a test runner later, document the commands here, including “run a single test”.
- In production, the backend serves static assets from `server/public` at the `/unicon` path. Ensure the built frontend is available there (e.g., copy `client/dist` to `server/public` or adjust Vite output).
- The frontend’s Vite base path is `/unicon/`. API requests in the UI use `/unicon/api/*` and WebSocket clients connect to `ws://<host>:WS_PORT`.

## Architecture and structure

High level
- Monorepo (npm workspaces): `client` (React 19 + Vite 5, Tailwind) and `server` (Node/Express + ws). The app is intentionally hosted under the subpath `/unicon` (both API and static UI) so it can be reverse‑proxied behind other sites.

Frontend (`client`)
- Build/runtime: Vite with React plugin; base path `/unicon/` (see `client/vite.config.js`). Dev proxy maps `/ws` to `ws://localhost:8080`. The UI talks to the backend via REST at `/unicon/api/*` and uses WebSockets for live updates.
- Core UI shell: `client/src/components/UniversalTestClient.jsx` orchestrates tabs, connection lifecycle, logs, and renders per‑protocol workspaces.
- Protocol workspaces (pluggable views under `client/src/workspaces/`):
  - REST client (`RestWorkspace.jsx`) and an advanced OpenAPI‑aware variant (`enhanced_rest_workspace.jsx`).
  - Placeholders for OPC UA, WebSocket chat, gRPC, CPD, SQL within `UniversalTestClient.jsx` with dedicated UI and fetch calls to `/unicon/api/operation`.
- Connection type catalog: `client/src/constants/connectionTypes.jsx` defines per‑protocol form schemas (fields, defaults) and icons, which drive the “New Connection” dialog and validation.

Backend (`server`)
- HTTP and WS servers: `server/universal-server.js` starts Express (HTTP on `PORT`, default 3001) and a standalone `ws` server (WebSocket on `WS_PORT`, default 8080). It mounts REST routes under `/unicon/api` and broadcasts events to connected WS clients.
- Static hosting: in production, Express serves `server/public` at `/unicon` and falls back to `server/public/index.html` for SPA routes.
- In‑memory state: connection registry and active connection map live in process memory (no DB by default). This is sufficient for local testing; persistence would require additional code.
- Enhanced REST handler: `server/handlers/enhanced_rest_handler.js` implements a capability layer for the REST workspace, including:
  - OpenAPI/Swagger ingestion (URL or uploaded file), schema parsing, endpoint cataloging, example request generation, and request validation.
  - A unified `request(method, endpoint, data, headers, params)` that merges default/auth headers and returns structured timing, headers, and body.
  - A `broadcast` hook which delegates to a global broadcaster so UI clients get live updates over WebSocket.

Routing contracts between UI and server
- The UI issues POSTs to `/unicon/api/operation` for actions like `request`, `browseTopics`, `simpleSubscribe`, `publish`, `getLatestData`, `validateRequest`, `getEndpoints`, and `generateExample`. The server should dispatch on `operation` to the appropriate handler (e.g., `EnhancedRestHandler`).
- Health/metadata endpoints are mounted under `/unicon/api` (e.g., `/unicon/api/health`).

Key configuration
- Vite: `client/vite.config.js` sets `base: '/unicon/'`, dev server port `5174`, and a dev proxy for `/ws` → `ws://localhost:8080`.
- Backend ports: `PORT` (HTTP, defaults to 3001) and `WS_PORT` (WebSocket, defaults to 8080). CORS allows `http://localhost:5174` during development.

Repository layout (select paths)
- client/
  - `src/components/UniversalTestClient.jsx` – main UI shell
  - `src/constants/connectionTypes.jsx` – per‑protocol form schema
  - `src/workspaces/*.jsx` – protocol‑specific UIs (REST, Enhanced REST, etc.)
  - `vite.config.js`, `tailwind.config.js`, `postcss.config.js`
- server/
  - `universal-server.js` – Express + ws bootstrap, `/unicon/api` routes, static hosting
  - `handlers/enhanced_rest_handler.js` – OpenAPI‑aware REST engine
  - `package.json` – `dev` (nodemon), `start`
- Root `package.json` – npm workspaces and `dev:all` (runs client and server concurrently)

Readme highlights
- The README describes a broader vision (multi‑protocol client, monitoring, Docker). For day‑to‑day development in this repo’s current state, the authoritative commands are in the sections above (dev, lint/format, build). Extend this WARP.md as additional tooling and tests are added.
