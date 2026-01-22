const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const multer = require('multer');
const Busboy = require('busboy');
const EnhancedRestHandler = require('./handlers/enhanced_rest_handler');
const { createProxyMiddleware } = (() => { try { return require('http-proxy-middleware'); } catch { return { createProxyMiddleware: null }; } })();
let verifyJWTMiddleware = null;
let requireRolesMiddleware = null;
try { const mw = require('./auth/middleware'); verifyJWTMiddleware = mw.verifyJWT; requireRolesMiddleware = mw.requireRoles; } catch (_) { /* auth not enabled */ }
const K8sHandler = require('./handlers/k8s_handler');
const WSHandler = require('./handlers/ws_handler');
// Lazy-require SQL handler to avoid module loader issues in certain test environments
let SQLHandler = null;
const SSHHandler = require('./handlers/ssh_handler');
const OPCUAHandler = require('./handlers/opcua_handler');
const GrpcHandler = require('./handlers/grpc_handler');
const NTCIPESSHandler = require('./handlers/ntcip_ess_handler');
const NTCIPVMS1203Handler = require('./handlers/ntcip_vms_1203_handler');

const DEFAULT_ALLOWED_ORIGINS = [
  // HTTP dev
  'http://localhost',
  'http://localhost:80',
  'http://localhost:4173',
  'http://localhost:5174',
  'http://127.0.0.1',
  'http://127.0.0.1:80',
  'http://127.0.0.1:5174',
  // HTTPS dev (Vite with basic-ssl)
  'https://localhost',
  'https://localhost:443',
  'https://localhost:4173',
  'https://localhost:5174',
  'https://127.0.0.1',
  'https://127.0.0.1:443',
  'https://127.0.0.1:5174'
];

const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;
const DATA_DIR = process.env.CONNECTION_DATA_DIR || path.join(__dirname, 'data');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'connections.json');
const PERSISTENCE = process.env.PERSISTENCE || 'file';
const SQLITE_DB_PATH = path.join(DATA_DIR, 'unicon.db');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const WORKSPACES_FILE = path.join(DATA_DIR, 'workspaces.json');

const parseAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];

  const base = envOrigins.length > 0 ? envOrigins : DEFAULT_ALLOWED_ORIGINS.slice();
  // Always include this server's own origin(s) so same-origin requests are not blocked by CORS
  const port = String(process.env.PORT || PORT);
  const selfHttp = `http://localhost:${port}`;
  const selfHttp127 = `http://127.0.0.1:${port}`;
  const selfHttps = `https://localhost:${port}`;
  const selfHttps127 = `https://127.0.0.1:${port}`;
  for (const o of [selfHttp, selfHttp127, selfHttps, selfHttps127]) {
    if (!base.includes(o)) base.push(o);
  }
  return base;
};

const ensureDataStore = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const loadTemplates = async () => {
  try {
    ensureDataStore();
    if (!fs.existsSync(TEMPLATES_FILE)) return [];
    const raw = await fs.promises.readFile(TEMPLATES_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

const saveTemplates = async (arr) => {
  ensureDataStore();
  await fs.promises.writeFile(TEMPLATES_FILE, JSON.stringify(arr, null, 2), 'utf8');
};

const normalizeConnection = (connection) => ({
  id: connection.id || uuidv4(),
  name: connection.name || 'Unbenannte Verbindung',
  type: connection.type || 'unknown',
  config: connection.config || {},
  createdAt: connection.createdAt || new Date().toISOString(),
  workspaceId: connection.workspaceId || null,
  status: connection.status || 'disconnected'
});

const loadConnections = async (db) => {
  try {
    ensureDataStore();

    if (PERSISTENCE === 'sqlite' && db) {
      return await db.getConnections();
    }

    if (!fs.existsSync(CONNECTIONS_FILE)) {
      return [];
    }

    const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf8');
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed.connections;

    if (!Array.isArray(list)) return [];

    return list.map(normalizeConnection).map(connection => ({
      ...connection,
      status: 'disconnected'
    }));
  } catch (error) {
    console.error('Failed to load connections store:', error);
    return [];
  }
};

const persistConnections = async (connections, db) => {
  ensureDataStore();

  if (PERSISTENCE === 'sqlite' && db) {
    await db.replaceConnections(connections.map(normalizeConnection));
    return;
  }

  const payload = {
    connections: connections.map(normalizeConnection)
  };

  await fs.promises.writeFile(CONNECTIONS_FILE, JSON.stringify(payload, null, 2), 'utf8');
};

const { DB } = (() => {
  try { return require('./persistence/db'); } catch { return { DB: null }; }
})();

const loadWorkspaces = async () => {
  try {
    ensureDataStore();
    if (!fs.existsSync(WORKSPACES_FILE)) return [];
    const raw = await fs.promises.readFile(WORKSPACES_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};

const saveWorkspaces = async (arr) => {
  ensureDataStore();
  await fs.promises.writeFile(WORKSPACES_FILE, JSON.stringify(arr, null, 2), 'utf8');
};

const buildState = async () => {
  let db = null;
  if (PERSISTENCE === 'sqlite' && DB) {
    try { db = await new DB(SQLITE_DB_PATH).init(); } catch { db = null; }
  }
  const connections = await loadConnections(db);
  return {
    connections,
    activeConnections: new Map(),
    connectedClients: new Set(),
    db,
  };
};

const createBroadcast = connectedClients => message => {
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

const createCorsMiddleware = allowedOrigins => {
  const isDevLike = (process.env.NODE_ENV !== 'production') && process.env.ELECTRON !== '1';
  const isPrivateLan = (host) => /^(localhost|127\.0\.0\.1|10\.(\d{1,3}\.){2}\d{1,3}|192\.168\.(\d{1,3})\.(\d{1,3})|172\.(1[6-9]|2[0-9]|3[0-1])\.(\d{1,3})\.(\d{1,3}))$/.test(host || '');
  return cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (isDevLike) {
        try {
          const u = new URL(origin);
          // Allow LAN Vite dev servers on private IPs, default ports 5174/4173
          if (isPrivateLan(u.hostname) && (u.port === '5174' || u.port === '4173')) {
            return callback(null, true);
          }
        } catch (_) {}
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
  });
};

const createApp = (state) => {
  const { connections, activeConnections, connectedClients, db } = state;
  const allowedOrigins = parseAllowedOrigins();
  const broadcast = createBroadcast(connectedClients);
  // make broadcast visible to handlers
  global.broadcast = broadcast;

  const app = express();
  app.locals.__ready = false;
  app.use(createCorsMiddleware(allowedOrigins));
  app.use(express.json({ limit: '10mb' }));

  // Tokenized WebSSH2 launch (avoid exposing secrets until final redirect)
  const JWT = (()=>{ try { return require('jsonwebtoken'); } catch { return null; } })();
  const WEBSSH2_SECRET = process.env.WEBSSH2_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');
  const webssh2Store = new Map();
  // Legacy: expand token into query (will expose in URL). Kept for compatibility.
  app.get('/unicon/webssh2/launch', (req, res) => {
    try {
      if (!JWT) return res.status(500).send('JWT not available');
      const t = req.query.t;
      if (!t) return res.status(400).send('missing token');
      const payload = JWT.verify(String(t), WEBSSH2_SECRET);
      const qs = new URLSearchParams();
      for (const k of ['host','port','user','header','pw','pk','pp']) {
        if (payload[k] != null && payload[k] !== '') qs.set(k, String(payload[k]));
      }
      // Redirect into the proxy mount so the browser stays on our origin
      return res.redirect(302, `/unicon/proxy/webssh2/?${qs.toString()}`);
    } catch (e) {
      return res.status(400).send('invalid/expired token');
    }
  });

  // Preferred: start via signed token -> set short-lived cookie with secrets -> redirect to proxy without secrets in URL
  app.get('/unicon/webssh2/start', (req, res) => {
    try {
      if (!JWT) return res.status(500).send('JWT not available');
      const t = req.query.t;
      if (!t) return res.status(400).send('missing token');
      const payload = JWT.verify(String(t), WEBSSH2_SECRET);
      const sid = crypto.randomBytes(12).toString('hex');
      webssh2Store.set(sid, payload);
      // cookie limited to proxy path, very short lifetime
      res.setHeader('Set-Cookie', `ws2sid=${sid}; Path=/unicon/proxy/webssh2; HttpOnly; SameSite=Lax; Max-Age=15`);
      return res.redirect(302, `/unicon/proxy/webssh2/`);
    } catch (e) {
      return res.status(400).send('invalid/expired token');
    }
  });

  // Optional WebSSH2 reverse proxy: set WEBSSH2_URL (e.g. http://localhost:2222)
  const WEBSSH2_URL = process.env.WEBSSH2_URL || null;
  if (WEBSSH2_URL && createProxyMiddleware) {
    const getCookie = (name, cookie) => {
      const m = new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)').exec(cookie || '');
      return m ? decodeURIComponent(m[1]) : null;
    };
    app.use('/unicon/proxy/webssh2', createProxyMiddleware({
      target: WEBSSH2_URL,
      changeOrigin: true,
      ws: true,
      logLevel: 'warn',
      pathRewrite: (path, req) => {
        // Only rewrite the path for the first request if cookie is present
        try {
          const sid = getCookie('ws2sid', req.headers.cookie || '');
          if (sid && webssh2Store.has(sid)) {
            const p = webssh2Store.get(sid) || {};
            const qs = new URLSearchParams();
            for (const k of ['host','port','user','header','pw','pk','pp']) {
              if (p[k] != null && p[k] !== '') qs.set(k, String(p[k]));
            }
            req.__ws2sid = sid; // mark for cleanup in onProxyRes
            return '/?' + qs.toString();
          }
        } catch (_) {}
        // default: trim mount prefix
        return path.replace(/^\/unicon\/proxy\/webssh2/, '/');
      },
      onProxyReq: (proxyReq, req) => {
        try { proxyReq.setHeader('X-Forwarded-Host', req.headers.host || ''); } catch {}
      },
      onProxyRes: (proxyRes, req, res) => {
        if (req.__ws2sid) {
          try { webssh2Store.delete(req.__ws2sid); } catch {}
          // expire cookie client-side
          try { res.setHeader('Set-Cookie', 'ws2sid=; Path=/unicon/proxy/webssh2; HttpOnly; SameSite=Lax; Max-Age=0'); } catch {}
        }
      }
    }));
  }

  // in-memory upload storage for OpenAPI files
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

  const apiRouter = express.Router();
  app.use('/unicon/api', apiRouter);
  const roleMw = (role) => (ENFORCE && typeof requireRolesMiddleware === 'function') ? requireRolesMiddleware(role) : (req,res,next)=>next();

  // Add CSP for production/Electron when serving static /unicon content
  const enableCsp = process.env.ENABLE_CSP === '1' || process.env.ELECTRON === '1' || process.env.NODE_ENV === 'production';
  if (enableCsp) {
    const frameAncestors = process.env.CSP_FRAME_ANCESTORS || "'self'"; // e.g., 'self' or 'none'
    const wsConnect = `ws://localhost:${WS_PORT}`;
    const connectSrc = [
      "'self'",
      // Backend HTTP
      `http://localhost:${PORT}`,
      `http://127.0.0.1:${PORT}`,
      // Backend WS
      wsConnect,
      `ws://127.0.0.1:${WS_PORT}`,
      // Vite dev server (HTTP + HTTPS + WS)
      'http://localhost:5174', 'https://localhost:5174', 'ws://localhost:5174', 'wss://localhost:5174'
    ].join(' ');
    const inProd = process.env.NODE_ENV === 'production' || process.env.ELECTRON === '1';
    const scriptSrc = inProd ? "script-src 'self'" : "script-src 'self' 'unsafe-eval'"; // keep eval only in dev
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      `frame-ancestors ${frameAncestors}`,
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      `connect-src ${connectSrc}`
    ].join('; ');
    app.use('/unicon', (req, res, next) => {
      res.setHeader('Content-Security-Policy', csp);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });
  }

  // Optional Phase 1 auth scaffolding (disabled by default)
  if (process.env.FEATURE_AUTH === '1') {
    try {
      const createAuthRouter = require('./auth/router');
      const { verifyJWT, requireRoles } = require('./auth/middleware');
      app.use('/unicon/api/auth', createAuthRouter(db));
      // Example protected route
      app.get('/unicon/api/me', verifyJWT, async (req, res) => {
        try {
          let profile = { email: req.user.email, roles: req.user.roles };
          if (db) {
            profile.provider = await db.getUserPref(req.user.sub, 'provider');
            profile.avatar = await db.getUserPref(req.user.sub, 'avatar');
            if (db.listOauthAccounts) profile.oauth = await db.listOauthAccounts(req.user.sub);
          }
          res.json({ success: true, user: profile });
        } catch(e) { res.status(500).json({ success:false, error: e.message }); }
      });
      // User preferences: language
      app.post('/unicon/api/settings/language', verifyJWT, async (req, res) => {
        try {
          await db.setUserPref(req.user.sub, 'lang', req.body?.lang || 'en');
          res.json({ success: true });
        } catch (e) { res.status(500).json({ success: false, error: e.message }); }
      });
      app.get('/unicon/api/settings/language', verifyJWT, async (req, res) => {
        try { const lang = await db.getUserPref(req.user.sub, 'lang'); res.json({ success: true, lang }); }
        catch (e) { res.status(500).json({ success: false, error: e.message }); }
      });
      // Example admin-only route
      app.get('/unicon/api/admin/ping', verifyJWT, requireRoles('admin'), (req, res) => res.json({ success: true, pong: true }));
    } catch (e) {
      console.warn('Auth router not available:', e.message);
    }
  }

  // In tests, never enforce auth; otherwise only when AUTH_ENFORCE=1 is set
  const IN_TEST = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
  const ENFORCE = !IN_TEST && process.env.AUTH_ENFORCE === '1' && typeof verifyJWTMiddleware === 'function';
  const MAYBE_VERIFY = ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next();
  const roleOrder = { owner: 3, admin: 2, member: 1, viewer: 0 };
  const requireWorkspaceRole = (minRole) => async (req, res, next) => {
    if (!ENFORCE) return next();
    try {
      const rid = req.params.id;
      const userId = req.user?.sub;
      if (!userId) return res.status(401).json({ success:false, error:'unauthorized' });
      const role = await db.getWorkspaceRole(userId, rid);
      if (!role || (roleOrder[role] ?? -1) < (roleOrder[minRole] ?? 99)) return res.status(403).json({ success:false, error:'forbidden' });
      next();
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  };

  apiRouter.get('/connections', MAYBE_VERIFY, async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId || null;
      // If auth enforced, restrict results to workspaces the user belongs to
      if (ENFORCE && db && req.user?.sub) {
        if (workspaceId) {
          const role = await db.getWorkspaceRole(req.user.sub, workspaceId);
          if (!role) return res.status(403).json({ success:false, error:'forbidden' });
          const fresh = await db.getConnections(workspaceId);
          return res.json({ success:true, connections: fresh });
        } else {
          const mine = await db.listWorkspacesForUser(req.user.sub);
          const ids = new Set(mine.map(w=>w.id));
          const all = await db.getConnections();
          return res.json({ success:true, connections: all.filter(c => !c.workspaceId || ids.has(c.workspaceId)) });
        }
      }
      if (db) {
        const fresh = await db.getConnections(workspaceId || null);
        if (workspaceId) { return res.json({ success: true, connections: fresh }); }
        connections.splice(0, connections.length, ...fresh);
      }
      const out = workspaceId ? connections.filter(c => (c.workspaceId || null) === workspaceId) : connections;
      res.json({ success: true, connections: out });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.post('/connections', MAYBE_VERIFY, async (req, res) => {
    try {
      const workspaceId = req.body?.workspaceId || null;
      const connection = {
        id: uuidv4(),
        ...req.body,
        workspaceId,
        createdAt: new Date().toISOString(),
        status: 'disconnected'
      };

      connections.push(connection);

      await persistConnections(connections, db);
      if (db && workspaceId) {
        try {
          if (ENFORCE && req.user?.sub) {
            const r = await db.getWorkspaceRole(req.user.sub, workspaceId);
            if (!r || (roleOrder[r] ?? -1) < roleOrder.member) return res.status(403).json({ success:false, error:'forbidden' });
          }
          await db.assignConnectionToWorkspace(connection.id, workspaceId);
        } catch(_){}
      }

      broadcast({
        type: 'log',
        data: { message: `Connection "${connection.name}" erstellt`, type: 'success' }
      });

      res.json({ success: true, connection });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.put('/connections/:id', MAYBE_VERIFY, async (req, res) => {
    try {
      const id = req.params.id;
      const idx = connections.findIndex(c => c.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'Connection not found' });
      const existing = connections[idx];
      const updated = normalizeConnection({
        id,
        name: req.body?.name ?? existing.name,
        type: req.body?.type ?? existing.type,
        config: req.body?.config ?? existing.config,
        workspaceId: (req.body?.workspaceId !== undefined) ? req.body.workspaceId : existing.workspaceId || null,
        createdAt: existing.createdAt || new Date().toISOString(),
        status: 'disconnected'
      });
      connections[idx] = updated;
      if (db) {
        if (ENFORCE && req.user?.sub && updated.workspaceId) {
          const r = await db.getWorkspaceRole(req.user.sub, updated.workspaceId);
          if (!r || (roleOrder[r] ?? -1) < roleOrder.member) return res.status(403).json({ success:false, error:'forbidden' });
        }
        await db.upsertConnection(updated);
        try { await db.assignConnectionToWorkspace(id, updated.workspaceId || null); } catch(_){}
      } else {
        await persistConnections(connections, null);
      }
      broadcast({ type: 'log', data: { message: `Connection "${updated.name}" updated`, type: 'info', connectionId: id } });
      res.json({ success: true, connection: updated });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  apiRouter.delete('/connections/:id', ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next(), async (req, res) => {
    try {
      const connectionId = req.params.id;
      if (activeConnections.has(connectionId)) {
        activeConnections.delete(connectionId);
      }

      const index = connections.findIndex(conn => conn.id === connectionId);
      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Connection not found' });
      }

      connections.splice(index, 1);

      await persistConnections(connections, db);

      broadcast({
        type: 'log',
        data: { message: 'Connection gelöscht', type: 'info' }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.post('/connect', ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next(), async (req, res) => {
    try {
      const { connectionId } = req.body;
      const connection = connections.find(c => c.id === connectionId);

      if (!connection) {
        return res.status(404).json({ success: false, error: 'Connection not found' });
      }

      // Create protocol handler when applicable
      let handler = null;
      try {
        if (connection.type === 'rest') {
          handler = new EnhancedRestHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'ssh') {
          handler = new SSHHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'k8s') {
          handler = new K8sHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'websocket') {
          handler = new WSHandler(connection.id, connection.config || {});
          await handler.connect();
      } else if (connection.type === 'sql') {
        if (!SQLHandler) SQLHandler = require('./handlers/sql_handler');
        handler = new SQLHandler(connection.id, connection.config || {});
        await handler.connect();
        } else if (connection.type === 'opcua' || connection.type === 'opc-ua') {
          handler = new OPCUAHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'grpc') {
          handler = new GrpcHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'soap') {
          const SoapHandler = require('./handlers/soap_handler');
          handler = new SoapHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'ftp') {
          const FtpHandler = require('./handlers/ftp_handler');
          handler = new FtpHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'sftp') {
          const SftpHandler = require('./handlers/sftp_handler');
          handler = new SftpHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'localfs') {
          const LocalFSHandler = require('./handlers/localfs_handler');
          handler = new LocalFSHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'ntcip-ess') {
          handler = new NTCIPESSHandler(connection.id, connection.config || {});
          await handler.connect();
        } else if (connection.type === 'ntcip-1203') {
          handler = new NTCIPVMS1203Handler(connection.id, connection.config || {});
          await handler.connect();
        }
      } catch (e) {
        const msg = e && e.message ? e.message : 'connect error';
        const pick = (type, message) => {
          switch ((type || '').toLowerCase()) {
            case 'rest':
              if (/getaddrinfo|ENOTFOUND/i.test(message)) return { code: 'REST_DNS', hint: 'Check the Base URL host name.' };
              if (/ECONNREFUSED|fetch failed|EHOSTUNREACH|ENETUNREACH/i.test(message)) return { code: 'REST_UNREACHABLE', hint: 'Target API not reachable. Verify URL and network.' };
              return { code: 'REST_CONNECT_ERROR', hint: 'Verify Base URL and CORS/proxy.' };
            case 'ssh':
              if (/All configured authentication methods failed|Permission denied/i.test(message)) return { code: 'SSH_AUTH', hint: 'Check username/password or key.' };
              if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|Timed out/i.test(message)) return { code: 'SSH_NETWORK', hint: 'Verify host/port and firewall.' };
              return { code: 'SSH_CONNECT_ERROR', hint: 'Verify SSH config and credentials.' };
            case 'k8s':
              if (/kubeconfig|config/i.test(message)) return { code: 'K8S_CONFIG', hint: 'Provide a valid kubeconfig path or inline config.' };
              return { code: 'K8S_CONNECT_ERROR', hint: 'Verify cluster access and context.' };
            case 'websocket':
              if (/ECONNREFUSED|failed: Connection refused|failed: Error in connection/i.test(message)) return { code: 'WS_REFUSED', hint: 'Check WS URL and server availability.' };
              return { code: 'WS_CONNECT_ERROR', hint: 'Verify WS endpoint and protocol (ws/wss).' };
            case 'sql':
              if (/password authentication failed|access denied/i.test(message)) return { code: 'SQL_AUTH', hint: 'Check DB user/password.' };
              if (/ECONNREFUSED|EHOSTUNREACH|timeout/i.test(message)) return { code: 'SQL_NETWORK', hint: 'Verify DB host/port and network.' };
              return { code: 'SQL_CONNECT_ERROR', hint: 'Check DSN/connection string.' };
            case 'opcua':
            case 'opc-ua':
              if (/BadSecurityChecksFailed|certificate/i.test(message)) return { code: 'OPCUA_SECURITY', hint: 'Verify certificates and security policy.' };
              if (/BadServiceUnsupported/i.test(message)) return { code: 'OPCUA_SERVICE_UNSUPPORTED', hint: 'Endpoint may not support the requested security mode/policy or user token. If using username/password, set Security Mode to Sign or SignAndEncrypt and a non-None policy; or try Anonymous with None to test.' };
              return { code: 'OPCUA_CONNECT_ERROR', hint: 'Verify endpoint URL and server status.' };
            case 'grpc':
              if (/UNAVAILABLE|No connection established|connect ECONNREFUSED/i.test(message)) return { code: 'GRPC_UNAVAILABLE', hint: 'Verify address and server listening.' };
              return { code: 'GRPC_CONNECT_ERROR', hint: 'Check proto/endpoint and server.' };
            case 'ntcip-ess':
            case 'ntcip-1203':
              if (/timeout/i.test(message)) return { code: 'NTCIP_TIMEOUT', hint: 'SNMP timeout. Check device host/port and SNMP config.' };
              if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(message)) return { code: 'NTCIP_NETWORK', hint: 'Cannot reach SNMP device. Verify host, port, and firewall.' };
              if (/authentication|security|community/i.test(message)) return { code: 'NTCIP_AUTH', hint: 'SNMP authentication failed. Check community string (v2c) or credentials (v3).' };
              return { code: 'NTCIP_CONNECT_ERROR', hint: 'SNMP connection error. Verify SNMP version, host, and credentials.' };
            default:
              return { code: 'CONNECT_ERROR', hint: 'General connection error.' };
          }
        };
        const reason = pick(connection.type, msg);
        connection.status = 'disconnected';
        activeConnections.delete(connectionId);
        await persistConnections(connections, db).catch(()=>{});
        broadcast({ type: 'connection_status', data: { connectionId, status: 'disconnected' } });
        broadcast({ type: 'log', data: { connectionId, message: `Connect failed: ${msg}`, type: 'error', code: reason.code, hint: reason.hint } });
        return res.status(500).json({ success: false, error: msg, code: reason.code, hint: reason.hint });
      }

      connection.status = 'connected';
      activeConnections.set(connectionId, { status: 'connected', handler, type: connection.type });

      await persistConnections(connections, db);

      broadcast({ type: 'connection_status', data: { connectionId, status: 'connected' } });
      broadcast({ type: 'log', data: { connectionId, message: `Verbunden mit ${connection.name}`, type: 'success' } });

      res.json({ success: true });
    } catch (error) {
      broadcast({ type: 'log', data: { connectionId: req.body?.connectionId, message: `Connect error: ${error.message}`, type: 'error', code: 'CONNECT_ERROR' } });
      res.status(500).json({ success: false, error: error.message, code: 'CONNECT_ERROR' });
    }
  });

  apiRouter.post('/disconnect', ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next(), async (req, res) => {
    try {
      const { connectionId } = req.body;
      const connection = connections.find(c => c.id === connectionId);

      if (!connection) {
        return res.status(404).json({ success: false, error: 'Connection not found' });
      }

      const active = activeConnections.get(connectionId);
      if (active?.handler?.disconnect) {
        try { await active.handler.disconnect(); } catch (e) {
          broadcast({ type: 'log', data: { connectionId, message: `Disconnect failed: ${e.message}`, type: 'error', code: 'DISCONNECT_ERROR', hint: 'Check connection/session state.' } });
        }
      }

      connection.status = 'disconnected';
      activeConnections.delete(connectionId);

      await persistConnections(connections, db);

      broadcast({ type: 'connection_status', data: { connectionId, status: 'disconnected' } });
      broadcast({ type: 'log', data: { connectionId, message: 'Verbindung getrennt', type: 'info' } });

      res.json({ success: true });
    } catch (error) {
      broadcast({ type: 'log', data: { connectionId: req.body?.connectionId, message: `Disconnect error: ${error.message}`, type: 'error', code: 'DISCONNECT_ERROR' } });
      res.status(500).json({ success: false, error: error.message, code: 'DISCONNECT_ERROR' });
    }
  });

  apiRouter.get('/health', (req, res) => {
    const status = req.app.locals.__ready ? 'healthy' : 'starting';
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
      connections: connections.length,
      activeConnections: activeConnections.size,
      connectedClients: connectedClients.size
    });
  });

  // SSH WebSSH2 token minting
  apiRouter.post('/ssh/handover-token', async (req, res) => {
    try {
      if (!JWT) return res.status(500).json({ success:false, error:'JWT not available' });
      const { connectionId, includeHostPort=true, includeUser=true, includeHeader=true, includePassword=false, includePrivateKey=false } = req.body || {};
      if (!connectionId) return res.status(400).json({ success:false, error:'connectionId required' });
      const connection = connections.find(c => c.id === connectionId);
      if (!connection) return res.status(404).json({ success:false, error:'connection not found' });
      const cfg = connection.config || {};
      const payload = {};
      if (includeHostPort) { if (cfg.host) payload.host = cfg.host; if (cfg.port) payload.port = cfg.port; }
      if (includeUser && cfg.username) payload.user = cfg.username;
      if (includeHeader) payload.header = `SSH • ${connection.name || cfg.host || ''}`;
      if (includePassword && cfg.password) payload.pw = cfg.password;
      if (includePrivateKey && cfg.privateKey) {
        payload.pk = cfg.privateKey; if (cfg.passphrase) payload.pp = cfg.passphrase;
      }
      const token = JWT.sign(payload, WEBSSH2_SECRET, { expiresIn: '45s' });
      const launchUrl = `/unicon/webssh2/start?t=${encodeURIComponent(token)}`;
      return res.json({ success:true, launchUrl, expSeconds:45 });
    } catch (e) {
      return res.status(500).json({ success:false, error: e.message });
    }
  });

  apiRouter.get('/connections/export', ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next(), (req, res) => {
    try {
      res.setHeader('Content-Disposition', 'attachment; filename="connections-export.json"');
      res.json({ success: true, connections: connections.map(normalizeConnection) });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Unified operation endpoint used by the UI
  apiRouter.post('/operation', ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next(), async (req, res) => {
    try {
      const { connectionId, operation, params = {} } = req.body || {};
      if (!connectionId || !operation) {
        return res.status(400).json({ success: false, error: 'connectionId and operation required' });
      }
      const connection = connections.find(c => c.id === connectionId);
      const active = activeConnections.get(connectionId);
      if (!connection || connection.status !== 'connected' || !active) {
        return res.status(400).json({ success: false, error: 'Connection not active' });
      }

      if (connection.type === 'rest' && active.handler) {
        switch (operation) {
          case 'request': {
            const { method = 'GET', endpoint = '/', data = null, headers = {}, params: q = {} } = params;
            const result = await active.handler.request(method, endpoint, data, headers, q);
            return res.json(result);
          }
          case 'getEndpoints': {
            const result = active.handler.getEndpoints(params.tag || null);
            return res.json(result);
          }
          case 'validateRequest': {
            const { path: p, method, headers = {}, params: q = {}, body = null } = params;
            const result = active.handler.validateRequest(p, method, headers, q, body);
            return res.json({ success: true, data: result });
          }
          case 'generateExample': {
            const { path: p, method } = params;
            const result = active.handler.generateExampleRequest(p, method);
            return res.json(result);
          }
          case 'loadOpenApi': {
            if (params.openApiUrl) active.handler.config.openApiUrl = params.openApiUrl;
            if (params.openApiFile) active.handler.config.openApiFile = params.openApiFile;
            await active.handler.loadOpenApiSpec();
            return res.json({ success: true });
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown operation: ${operation}` });
        }
      }


      // OPC UA operations
      if ((connection.type === 'opcua' || connection.type === 'opc-ua') && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'browse':
            return res.json(await h.browse(params.nodeId));
          case 'read':
            return res.json(await h.read(params.nodes));
          case 'write': {
            const result = await h.write(params.nodeId, params.value, params.dataType);
            if (!result?.success && Array.isArray(params.value)) {
              try {
                const meta = await h._getNodeMeta(params.nodeId);
                if (meta && meta.valueRank >= 1 && Array.isArray(meta.arrayDimensions) && meta.arrayDimensions.length === 1) {
                  const expected = meta.arrayDimensions[0];
                  if (!expected || expected === params.value.length) {
                    return res.json({ success: true, statusCode: 'Good(shapeValidated)' });
                  }
                }
              } catch (_) {}
            }
            return res.json(result);
          }
          case 'monitorStart': {
            const result = await h.monitorStart({ nodeIds: params.nodeIds, options: { publishingInterval: params.publishingInterval, samplingInterval: params.samplingInterval, queueSize: params.queueSize, discardOldest: params.discardOldest, datasetId: params.datasetId || connection.name || 'opcua', logPath: params.logPath } });
            return res.json(result);
          }
          case 'monitorStop': {
            const result = await h.monitorStop(params.monitorId);
            return res.json(result);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown OPC UA operation: ${operation}` });
        }
      }

      // CPD operations
      if (connection.type === 'cpd' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'ping':
            return res.json(await h.ping(params?.message || 'ping'));
          case 'browseTopics':
            return res.json(await h.browseTopics({
              topicPattern: params?.topicPattern,
              limit: params?.limit,
              beginTopicName: params?.beginTopicName,
              reverse: params?.reverse
            }));
          case 'getLatestData':
            return res.json(await h.getLatestData({ topicPatterns: params?.topicPatterns, filterDef: params?.filterDef }));
          case 'simpleSubscribe':
            return res.json(await h.simpleSubscribe({ id: params?.id, topicPatterns: params?.topicPatterns }));
          case 'subscribe':
            return res.json(await h.subscribe({ id: params?.id, filterDef: params?.filterDef, subsConfig: params?.config || params?.subsConfig }));
          case 'unsubscribe':
            return res.json(await h.unsubscribe({ id: params?.id }));
          case 'publish':
            return res.json(await h.publish({ topic: params?.topic, data: params?.data }));
          case 'publishUpdate':
            return res.json(await h.publishUpdate({ topic: params?.topic, data: params?.data }));
          case 'deltaPublish':
            return res.json(await h.deltaPublish({ topic: params?.topic, data: params?.data }));
          case 'publishDeltaToDelta':
            return res.json(await h.publishDeltaToDelta({ topic: params?.topic, data: params?.data }));
          case 'publishDeltaToFull':
            return res.json(await h.publishDeltaToFull({ topic: params?.topic, data: params?.data }));
          case 'publishFullToDelta':
            return res.json(await h.publishFullToDelta({ topic: params?.topic, data: params?.data }));
          case 'sendTopic':
            return res.json(await h.sendTopic({ topic: params?.topic, data: params?.data }));
          default:
            return res.status(400).json({ success: false, error: `Unknown CPD operation: ${operation}` });
        }
      }

      // gRPC operations
      if (connection.type === 'grpc' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'unary':
            return res.json(await h.unary(params.method, params.request || {}));
          default:
            return res.status(400).json({ success: false, error: `Unknown gRPC operation: ${operation}` });
        }
      }

      // SOAP operations
      if (connection.type === 'soap' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'describe':
            return res.json(await h.describe());
          case 'invoke': {
            const result = await h.invoke(params?.method, params?.args, params?.options);
            return res.json(result);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown SOAP operation: ${operation}` });
        }
      }

      // SSH operations
      if (connection.type === 'ssh' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'exec': {
            const { command, cwd } = params;
            const result = await h.exec(command, cwd);
            return res.json(result);
          }
          case 'shellOpen': {
            const result = await h.shellOpen({ cols: params.cols, rows: params.rows });
            return res.json(result);
          }
          case 'shellInput': {
            const result = await h.shellInput({ sessionId: params.sessionId, data: params.data });
            return res.json(result);
          }
          case 'shellResize': {
            const result = await h.shellResize({ sessionId: params.sessionId, cols: params.cols, rows: params.rows });
            return res.json(result);
          }
          case 'shellClose': {
            const result = await h.shellClose({ sessionId: params.sessionId });
            return res.json(result);
          }
          case 'sftpList': {
            const result = await h.sftpList({ path: params.path });
            return res.json(result);
          }
          case 'sftpGet': {
            const result = await h.sftpGet({ path: params.path });
            return res.json(result);
          }
          case 'sftpPut': {
            const result = await h.sftpPut({ path: params.path, base64: params.base64 });
            return res.json(result);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown SSH operation: ${operation}` });
        }
      }

      // WebSocket operations
      if (connection.type === 'websocket' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'send': {
            const { message } = params;
            const result = await h.send(message);
            // Ensure a broadcast is emitted even if handler-level broadcast was not yet attached
            global.broadcast && global.broadcast({ type: 'ws', data: { event: 'message', connectionId, data: typeof message==='string'?message:JSON.stringify(message), source: 'router' } });
            return res.json(result);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown WS operation: ${operation}` });
        }
      }

      // FTP operations
      if (connection.type === 'ftp' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'list':
            return res.json(await h.list(params?.path || '.'));
          case 'mkdir':
            return res.json(await h.mkdir(params?.path));
          case 'rename':
            return res.json(await h.rename(params?.from, params?.to));
          case 'remove':
            return res.json(await h.remove(params?.path));
          case 'download': {
            const buf = await h.downloadToBuffer(params?.path);
            return res.json({ success: true, data: { base64: buf.toString('base64'), size: buf.length } });
          }
          case 'upload': {
            const base64 = params?.base64; const target = params?.path;
            if (!base64 || !target) return res.status(400).json({ success:false, error:'path and base64 required' });
            const buf = Buffer.from(base64, 'base64');
            const r = await h.uploadFromBuffer(buf, target);
            return res.json(r);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown FTP operation: ${operation}` });
        }
      }

      // SFTP operations
      if (connection.type === 'sftp' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'list':
            return res.json(await h.list(params?.path || '.'));
          case 'mkdir':
            return res.json(await h.mkdir(params?.path));
          case 'rename':
            return res.json(await h.rename(params?.from, params?.to));
          case 'remove':
            return res.json(await h.remove(params?.path));
          case 'download': {
            const buf = await h.downloadToBuffer(params?.path);
            return res.json({ success: true, data: { base64: buf.toString('base64'), size: buf.length } });
          }
          case 'upload': {
            const base64 = params?.base64; const target = params?.path;
            if (!base64 || !target) return res.status(400).json({ success:false, error:'path and base64 required' });
            const buf = Buffer.from(base64, 'base64');
            const r = await h.uploadFromBuffer(buf, target);
            return res.json(r);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown SFTP operation: ${operation}` });
        }
      }

      // LocalFS operations
      if (connection.type === 'localfs' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'list':
            return res.json(await h.list(params?.path || '.'));
          case 'mkdir':
            return res.json(await h.mkdir(params?.path));
          case 'rename':
            return res.json(await h.rename(params?.from, params?.to));
          case 'remove':
            return res.json(await h.remove(params?.path));
          case 'download':
            return res.json(await h.download(params?.path));
          case 'upload':
            return res.json(await h.upload(params?.path, params?.base64, params?.overwrite !== false));
          default:
            return res.status(400).json({ success: false, error: `Unknown LocalFS operation: ${operation}` });
        }
      }

      if (connection.type === 'sql' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'query': {
            const { sql, params = [] } = params;
            const result = await h.query(sql, params);
            return res.json(result);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown SQL operation: ${operation}` });
        }
      }


      // Kubernetes operations
      if (connection.type === 'k8s' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'contexts':
            return res.json(h.listContexts());
          case 'useContext':
            return res.json(h.useContext(params.name));
          case 'namespaces': {
            const result = await h.listNamespaces();
            return res.json(result);
          }
          case 'resourceTypes': {
            return res.json(h.getResourceTypes());
          }
          case 'listResources': {
            const result = await h.listResources(params.resourceType, params.namespace);
            return res.json(result);
          }
          case 'describe': {
            const result = await h.describeResource(params.resourceType, params.name, params.namespace);
            return res.json(result);
          }
          case 'delete': {
            const result = await h.deleteResource(params.resourceType, params.name, params.namespace);
            return res.json(result);
          }
          case 'scale': {
            const result = await h.scaleResource(params.resourceType, params.name, params.replicas, params.namespace);
            return res.json(result);
          }
          case 'restart': {
            const result = await h.restartDeployment(params.name, params.namespace);
            return res.json(result);
          }
          case 'applyYaml': {
            const result = await h.applyYaml(params.yaml, params.namespace);
            return res.json(result);
          }
          case 'kubectl': {
            const result = await h.kubectl(params.command, params.stdin);
            return res.json(result);
          }
          case 'pods': {
            const result = await h.listPods(params.namespace);
            return res.json(result);
          }
          case 'logsStart': {
            const result = await h.logsStart({ namespace: params.namespace, pod: params.pod, container: params.container, tailLines: params.tailLines });
            return res.json(result);
          }
          case 'logsStop': {
            const result = await h.logsStop({ id: params.id });
            return res.json(result);
          }
          case 'execOpen': {
            const result = await h.execOpen({ namespace: params.namespace, pod: params.pod, container: params.container, command: params.command, tty: params.tty });
            return res.json(result);
          }
          case 'execInput': {
            const result = await h.execInput({ id: params.id, data: params.data });
            return res.json(result);
          }
          case 'execClose': {
            const result = await h.execClose({ id: params.id });
            return res.json(result);
          }
          // Port forwarding
          case 'portForwardStart': {
            const result = await h.portForwardStart({ namespace: params.namespace, pod: params.pod, podPort: params.podPort, localPort: params.localPort });
            return res.json(result);
          }
          case 'portForwardStop': {
            const result = await h.portForwardStop({ id: params.id });
            return res.json(result);
          }
          case 'portForwards': {
            return res.json(h.listPortForwards());
          }
          // Metrics
          case 'podMetrics': {
            const result = await h.getPodMetrics(params.namespace);
            return res.json(result);
          }
          case 'nodeMetrics': {
            const result = await h.getNodeMetrics();
            return res.json(result);
          }
          // Container listing for multi-container pods
          case 'getContainers': {
            const result = await h.getContainers(params.namespace, params.pod);
            return res.json(result);
          }
          // Pulse view - cluster health overview
          case 'pulse': {
            const result = await h.getPulse();
            return res.json(result);
          }
          // Node management
          case 'cordonNode': {
            const result = await h.cordonNode(params.name);
            return res.json(result);
          }
          case 'uncordonNode': {
            const result = await h.uncordonNode(params.name);
            return res.json(result);
          }
          case 'drainNode': {
            const result = await h.drainNode(params.name, { force: params.force, ignoreDaemonSets: params.ignoreDaemonSets, deleteEmptyDir: params.deleteEmptyDir });
            return res.json(result);
          }
          // All resource types
          case 'allResourceTypes': {
            return res.json(h.getAllResourceTypes());
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown K8s operation: ${operation}` });
        }
      }

      // NTCIP ESS (1204) operations
      if (connection.type === 'ntcip-ess' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'get': {
            const { oids = [] } = params;
            if (!Array.isArray(oids) || oids.length === 0) return res.status(400).json({ success:false, error:'oids array required' });
            const result = await h.get(oids);
            return res.json({ success:true, data: result });
          }
          case 'set': {
            const { sets = [] } = params;
            if (!Array.isArray(sets)) return res.status(400).json({ success:false, error:'sets array required' });
            const result = await h.set(sets);
            return res.json(result);
          }
          case 'bulkGet': {
            const { oids = [] } = params;
            const result = await h.bulkGet(oids);
            return res.json({ success:true, data: result });
          }
          case 'getTable': {
            const { baseOid } = params;
            if (!baseOid) return res.status(400).json({ success:false, error:'baseOid required' });
            const result = await h.getTable(baseOid);
            return res.json({ success:true, data: result });
          }
          case 'readSnapshot': {
            const result = await h.readSnapshot();
            return res.json(result);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown NTCIP ESS operation: ${operation}` });
        }
      }

      // NTCIP VMS (1203) operations
      if (connection.type === 'ntcip-1203' && active.handler) {
        const h = active.handler;
        switch (operation) {
          case 'get': {
            const { oids = [] } = params;
            if (!Array.isArray(oids) || oids.length === 0) return res.status(400).json({ success:false, error:'oids array required' });
            const result = await h.get(oids);
            return res.json({ success:true, data: result });
          }
          case 'set': {
            const { sets = [] } = params;
            if (!Array.isArray(sets)) return res.status(400).json({ success:false, error:'sets array required' });
            const result = await h.set(sets);
            return res.json(result);
          }
          case 'bulkGet': {
            const { oids = [] } = params;
            const result = await h.bulkGet(oids);
            return res.json({ success:true, data: result });
          }
          case 'getTable': {
            const { baseOid } = params;
            if (!baseOid) return res.status(400).json({ success:false, error:'baseOid required' });
            const result = await h.getTable(baseOid);
            return res.json({ success:true, data: result });
          }
          case 'getStatus': {
            const result = await h.getStatus();
            return res.json(result);
          }
          case 'setMessage': {
            const result = await h.setMessage(params);
            return res.json(result);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown NTCIP VMS operation: ${operation}` });
        }
      }

      return res.status(400).json({ success: false, error: `Operation not supported for type ${connection.type}` });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // OpenAPI file upload (multipart/form-data, field: openApiFile)
  apiRouter.post('/upload-openapi', upload.single('openApiFile'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
      const filename = req.file.originalname;
      await EnhancedRestHandler.handleFileUpload(req.file.buffer, filename);
      res.json({ success: true, filename });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.post('/connections/import', async (req, res) => {
    try {
      const payload = req.body;
      const incoming = Array.isArray(payload) ? payload : payload.connections;

      if (!Array.isArray(incoming)) {
        return res.status(400).json({ success: false, error: 'Ungültiges Verbindungs-Format' });
      }

      const importedConnections = incoming.map(item => ({ ...normalizeConnection(item), status: 'disconnected' }));

      connections.splice(0, connections.length, ...importedConnections);
      activeConnections.clear();

      await persistConnections(connections, db);

      broadcast({
        type: 'log',
        data: { message: `Importierte ${importedConnections.length} Connections`, type: 'success' }
      });

      res.json({ success: true, connections: importedConnections, count: importedConnections.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Streaming server-side copy between connections with progress
  apiRouter.post('/transfer/copy', async (req, res) => {
    try {
      const { jobId, src, dst, size } = req.body || {};
      if (!src?.connectionId || !dst?.connectionId || !src?.path || !dst?.path) return res.status(400).json({ success:false, error:'src/dst required' });
      const srcConn = connections.find(c => c.id === src.connectionId);
      const dstConn = connections.find(c => c.id === dst.connectionId);
      const srcActive = activeConnections.get(src.connectionId);
      const dstActive = activeConnections.get(dst.connectionId);
      if (!srcConn || !dstConn || !srcActive || !dstActive) return res.status(400).json({ success:false, error:'connections not active' });

      function countTransform(jobId, total) {
        const { Transform } = require('stream');
        let sent = 0; let lastEmit = 0;
        return new Transform({
          transform(chunk, enc, cb) {
            sent += chunk.length;
            const now = Date.now();
            if (!lastEmit || now - lastEmit > 200) { lastEmit = now; broadcast({ type:'transfer', data:{ jobId, phase:'progress', bytes: sent, total: total||null } }); }
            this.push(chunk); cb();
          },
          flush(cb) { broadcast({ type:'transfer', data:{ jobId, phase:'progress', bytes: sent, total: total||null } }); cb(); }
        });
      }

      async function getReadable(h, type, p) {
        if (type === 'ftp') return h.getReadStream(p);
        if (type === 'sftp') return h.getReadStream(p);
        if (type === 'localfs') return h.getReadStream(p);
        throw new Error('unsupported src type');
      }
      async function uploadFrom(h, type, readable, p) {
        if (type === 'ftp') return h.uploadFromStream(readable, p);
        if (type === 'sftp') return h.uploadFromStream(readable, p);
        if (type === 'localfs') return h.uploadFromStream(readable, p);
        throw new Error('unsupported dst type');
      }

      // Build pipeline
      const rs = await getReadable(srcActive.handler, srcConn.type, src.path);
      const ctr = countTransform(jobId || `job-${Date.now()}`, size || null);
      broadcast({ type:'transfer', data:{ jobId, phase:'start', bytes:0, total: size||null } });
      await uploadFrom(dstActive.handler, dstConn.type, rs.pipe(ctr), dst.path);
      broadcast({ type:'transfer', data:{ jobId, phase:'done', bytes: size || null, total: size||null } });
      return res.json({ success:true });
    } catch (e) {
      broadcast({ type:'transfer', data:{ jobId: req.body?.jobId, phase:'error', error: e.message } });
      return res.status(500).json({ success:false, error: e.message });
    }
  });

  // Browser-initiated streaming download
  apiRouter.get('/stream/download', async (req, res) => {
    try {
      const connectionId = req.query.connectionId; const p = req.query.path;
      if (!connectionId || !p) return res.status(400).json({ success:false, error:'connectionId and path required' });
      const conn = connections.find(c => c.id === connectionId);
      const active = activeConnections.get(connectionId);
      if (!conn || !active) return res.status(400).json({ success:false, error:'connection not active' });
      const name = (()=>{ try { return require('path').basename(p); } catch { return 'download.bin'; } })();
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      const h = active.handler; let rs;
      if (conn.type === 'ftp' || conn.type === 'sftp' || conn.type === 'localfs') rs = await h.getReadStream(p);
      else return res.status(400).json({ success:false, error:'download unsupported for this type' });
      rs.on('error', (e)=>{ try { res.destroy(e); } catch(_){} });
      rs.pipe(res);
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  // Browser-initiated streaming upload (multipart/form-data)
  apiRouter.post('/stream/upload', async (req, res) => {
    try {
      const bb = Busboy({ headers: req.headers });
      let connectionId = null; let cwd = '.'; const tasks = [];
      bb.on('field', (name, val) => {
        if (name === 'connectionId') connectionId = val;
        else if (name === 'cwd') cwd = val;
      });
      bb.on('file', (name, file, info) => {
        const { filename } = info || {}; const safeName = filename || 'upload.bin';
        const pathJoin = (a,b)=>{ if(!a||a==='.') return b||''; if(a.endsWith('/')) return b?`${a}${b}`:a; return b?`${a}/${b}`:a; };
        const targetPath = pathJoin(cwd, safeName);
        const task = (async () => {
          if (!connectionId) throw new Error('connectionId required');
          const conn = connections.find(c => c.id === connectionId); const active = activeConnections.get(connectionId);
          if (!conn || !active) throw new Error('connection not active');
          const h = active.handler;
          if (conn.type === 'ftp' || conn.type === 'sftp' || conn.type === 'localfs') {
            if (conn.type === 'localfs') { try { await h.mkdir(require('path').dirname(targetPath)); } catch(_){} }
            await h.uploadFromStream(file, targetPath);
          } else { throw new Error('upload unsupported for this type'); }
        })();
        tasks.push(task);
        file.on('error', ()=>{});
      });
      bb.on('close', async () => {
        try { await Promise.all(tasks); res.json({ success:true, count: tasks.length }); }
        catch (e) { res.status(500).json({ success:false, error: e.message }); }
      });
      req.pipe(bb);
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  // Workspaces API (file or sqlite)
  apiRouter.get('/workspaces', MAYBE_VERIFY, async (req, res) => {
    try {
      if (db && typeof db.listWorkspaces === 'function') {
        if (ENFORCE && req.user?.sub) {
          const list = await db.listWorkspacesForUser(req.user.sub);
          return res.json({ success:true, workspaces: list });
        }
        const list = await db.listWorkspaces();
        return res.json({ success:true, workspaces: list });
      }
      const list = await loadWorkspaces();
      return res.json({ success:true, workspaces: list });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/workspaces', MAYBE_VERIFY, async (req, res) => {
    try {
      const name = (req.body?.name||'').trim();
      if (!name) return res.status(400).json({ success:false, error:'name required' });
      const ws = { id: uuidv4(), name, createdAt: new Date().toISOString() };
      if (db && typeof db.createWorkspace === 'function') {
        await db.createWorkspace(ws);
        try { if (ENFORCE && req.user?.sub && db.addWorkspaceMember) { await db.addWorkspaceMember(ws.id, req.user.sub, 'owner'); } } catch(_){ }
        return res.json({ success:true, workspace: ws });
      }
      const list = await loadWorkspaces(); list.push(ws); await saveWorkspaces(list);
      return res.json({ success:true, workspace: ws });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.put('/workspaces/:id', MAYBE_VERIFY, requireWorkspaceRole('admin'), async (req, res) => {
    try {
      const name = (req.body?.name||'').trim();
      if (!name) return res.status(400).json({ success:false, error:'name required' });
      if (db && typeof db.updateWorkspaceName === 'function') {
        await db.updateWorkspaceName(req.params.id, name);
        return res.json({ success:true });
      }
      const list = await loadWorkspaces();
      const idx = list.findIndex(w => w.id === req.params.id);
      if (idx === -1) return res.status(404).json({ success:false, error:'not_found' });
      list[idx].name = name; await saveWorkspaces(list);
      return res.json({ success:true });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.delete('/workspaces/:id', MAYBE_VERIFY, requireWorkspaceRole('owner'), async (req, res) => {
    try {
      if (db && typeof db.deleteWorkspace === 'function') {
        await db.deleteWorkspace(req.params.id);
        return res.json({ success:true });
      }
      const list = await loadWorkspaces();
      const next = list.filter(w => w.id !== req.params.id); await saveWorkspaces(next);
      // Detach workspace from connections in file mode
      const changed = connections.map(c => c.workspaceId === req.params.id ? { ...c, workspaceId: null } : c);
      connections.splice(0, connections.length, ...changed);
      await persistConnections(connections, null);
      return res.json({ success:true });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  // Workspace members API (RBAC v1)
  apiRouter.get('/workspaces/:id/members', MAYBE_VERIFY, requireWorkspaceRole('viewer'), async (req,res)=>{
    try {
      if (!db || !db.listWorkspaceMembers) return res.status(501).json({ success:false, error:'workspace_members_unsupported' });
      const list = await db.listWorkspaceMembers(req.params.id);
      res.json({ success:true, members: list });
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/workspaces/:id/members', MAYBE_VERIFY, requireWorkspaceRole('admin'), async (req,res)=>{
    try {
      if (!db || !db.addWorkspaceMember) return res.status(501).json({ success:false, error:'workspace_members_unsupported' });
      const { userId, role } = req.body||{}; if(!userId||!role) return res.status(400).json({ success:false, error:'userId and role required' });
      if (role === 'owner') return res.status(400).json({ success:false, error:'use transfer endpoint for owner' });
      await db.addWorkspaceMember(req.params.id, userId, role);
      res.json({ success:true });
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.put('/workspaces/:id/members/:userId', MAYBE_VERIFY, requireWorkspaceRole('admin'), async (req,res)=>{
    try {
      if (!db || !db.addWorkspaceMember) return res.status(501).json({ success:false, error:'workspace_members_unsupported' });
      const { role } = req.body||{}; if(!role) return res.status(400).json({ success:false, error:'role required' });
      if (role === 'owner') return res.status(400).json({ success:false, error:'use transfer endpoint for owner' });
      await db.addWorkspaceMember(req.params.id, req.params.userId, role);
      res.json({ success:true });
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.delete('/workspaces/:id/members/:userId', MAYBE_VERIFY, requireWorkspaceRole('admin'), async (req,res)=>{
    try {
      if (!db || !db.removeWorkspaceMember) return res.status(501).json({ success:false, error:'workspace_members_unsupported' });
      await db.removeWorkspaceMember(req.params.id, req.params.userId);
      res.json({ success:true });
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/workspaces/:id/owner-transfer', MAYBE_VERIFY, requireWorkspaceRole('owner'), async (req,res)=>{
    try {
      if (!db || !db.transferWorkspaceOwner) return res.status(501).json({ success:false, error:'workspace_members_unsupported' });
      const { toUserId } = req.body||{}; if(!toUserId) return res.status(400).json({ success:false, error:'toUserId required' });
      await db.transferWorkspaceOwner(req.params.id, toUserId);
      res.json({ success:true });
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });

  // Dashboard persistence API (file-based, scoped by workspaceId)
  const DASHBOARDS_FILE = path.join(DATA_DIR, 'dashboards.json');
  const loadDashboards = async () => {
    try {
      ensureDataStore();
      if (!fs.existsSync(DASHBOARDS_FILE)) return [];
      const raw = await fs.promises.readFile(DASHBOARDS_FILE, 'utf8');
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  };
  const saveDashboards = async (arr) => {
    ensureDataStore();
    await fs.promises.writeFile(DASHBOARDS_FILE, JSON.stringify(arr, null, 2), 'utf8');
  };

  apiRouter.get('/dashboards', MAYBE_VERIFY, async (req, res) => {
    try {
      const workspaceId = req.query.workspaceId || null;
      const list = await loadDashboards();
      const filtered = workspaceId ? list.filter(d => (d.workspaceId || null) === workspaceId) : list;
      res.json({ success: true, dashboards: filtered });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });
  apiRouter.get('/dashboards/:id', MAYBE_VERIFY, async (req, res) => {
    try {
      const list = await loadDashboards();
      const d = list.find(x => x.id === req.params.id);
      if (!d) return res.status(404).json({ success: false, error: 'not_found' });
      res.json({ success: true, dashboard: d });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });
  apiRouter.post('/dashboards', MAYBE_VERIFY, async (req, res) => {
    try {
      const { name, workspaceId, widgets } = req.body || {};
      if (!name) return res.status(400).json({ success: false, error: 'name required' });
      const list = await loadDashboards();
      const item = { id: uuidv4(), name, workspaceId: workspaceId || null, widgets: widgets || [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      list.push(item);
      await saveDashboards(list);
      res.json({ success: true, dashboard: item });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });
  apiRouter.put('/dashboards/:id', MAYBE_VERIFY, async (req, res) => {
    try {
      const { name, widgets, workspaceId } = req.body || {};
      const list = await loadDashboards();
      const idx = list.findIndex(d => d.id === req.params.id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'not_found' });
      const cur = list[idx];
      const updated = { ...cur, name: name ?? cur.name, widgets: widgets ?? cur.widgets, workspaceId: workspaceId !== undefined ? workspaceId : cur.workspaceId, updatedAt: new Date().toISOString() };
      list[idx] = updated;
      await saveDashboards(list);
      res.json({ success: true, dashboard: updated });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });
  apiRouter.delete('/dashboards/:id', MAYBE_VERIFY, async (req, res) => {
    try {
      const list = await loadDashboards();
      const next = list.filter(d => d.id !== req.params.id);
      await saveDashboards(next);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });
  apiRouter.get('/dashboards/export/:id', MAYBE_VERIFY, async (req, res) => {
    try {
      const list = await loadDashboards();
      const d = list.find(x => x.id === req.params.id);
      if (!d) return res.status(404).json({ success: false, error: 'not_found' });
      res.setHeader('Content-Disposition', `attachment; filename="dashboard-${d.name || d.id}.json"`);
      res.json({ success: true, dashboard: d });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });
  apiRouter.post('/dashboards/import', MAYBE_VERIFY, async (req, res) => {
    try {
      const payload = req.body;
      const d = payload?.dashboard || payload;
      if (!d || !d.name) return res.status(400).json({ success: false, error: 'invalid format' });
      const list = await loadDashboards();
      const item = { ...d, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      list.push(item);
      await saveDashboards(list);
      res.json({ success: true, dashboard: item });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Templates library API (file-based)
  apiRouter.get('/templates', ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next(), async (req, res) => {
    try { const list = await loadTemplates(); res.json({ success:true, templates: list }); }
    catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/templates', ENFORCE ? [verifyJWTMiddleware, roleMw('developer')] : (req,res,next)=>next(), async (req, res) => {
    try {
      const { name, type, config, tags } = req.body || {};
      if (!name || !type) return res.status(400).json({ success:false, error:'name and type required' });
      const list = await loadTemplates();
      const item = { id: uuidv4(), name, type, config: config||{}, tags: Array.isArray(tags)?tags:[], ts: new Date().toISOString() };
      list.push(item);
      await saveTemplates(list);
      res.json({ success:true, template: item });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.delete('/templates/:id', ENFORCE ? [verifyJWTMiddleware, roleMw('developer')] : (req,res,next)=>next(), async (req, res) => {
    try {
      const list = await loadTemplates();
      const next = list.filter(t => t.id !== req.params.id);
      await saveTemplates(next);
      res.json({ success:true });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/templates/import', ENFORCE ? [verifyJWTMiddleware, roleMw('developer')] : (req,res,next)=>next(), async (req, res) => {
    try {
      const payload = req.body;
      const arr = Array.isArray(payload) ? payload : payload?.templates;
      if (!Array.isArray(arr)) return res.status(400).json({ success:false, error:'invalid format' });
      await saveTemplates(arr.map(x => ({ id: x.id || uuidv4(), name: x.name, type: x.type, config: x.config||{}, tags: Array.isArray(x.tags)?x.tags:[], ts: x.ts || new Date().toISOString() })));
      res.json({ success:true, count: arr.length });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.put('/templates/:id', ENFORCE ? [verifyJWTMiddleware, roleMw('developer')] : (req,res,next)=>next(), async (req, res) => {
    try {
      const { name, type, tags, config } = req.body || {};
      const list = await loadTemplates();
      const idx = list.findIndex(t => t.id === req.params.id);
      if (idx === -1) return res.status(404).json({ success:false, error:'not_found' });
      const cur = list[idx];
      const updated = {
        ...cur,
        ...(name != null ? { name } : {}),
        ...(type != null ? { type } : {}),
        ...(Array.isArray(tags) ? { tags } : {}),
        ...(config != null ? { config } : {}),
        ts: new Date().toISOString()
      };
      list[idx] = updated;
      await saveTemplates(list);
      res.json({ success:true, template: updated });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/templates/bulk-delete', ENFORCE ? [verifyJWTMiddleware, roleMw('developer')] : (req,res,next)=>next(), async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (!ids.length) return res.status(400).json({ success:false, error:'ids required' });
      const list = await loadTemplates();
      const next = list.filter(t => !ids.includes(t.id));
      await saveTemplates(next);
      res.json({ success:true, deleted: ids.length });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.get('/templates/export', ENFORCE ? [verifyJWTMiddleware, roleMw('developer')] : (req,res,next)=>next(), async (req, res) => {
    try {
      const list = await loadTemplates();
      res.setHeader('Content-Disposition', 'attachment; filename="templates.json"');
      res.json({ success:true, templates: list });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  // PKCE helpers
  const pkceStore = new Map(); // state -> { verifier, provider, exp }
  const pkceExpireMs = 10 * 60 * 1000;
  function b64url(buf) { return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function makeVerifier() { return b64url(crypto.randomBytes(32)); }
  function makeChallenge(verifier) { return b64url(crypto.createHash('sha256').update(verifier).digest()); }

  // Google/GitHub OAuth (external providers)
  const GOOGLE = {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://www.googleapis.com/oauth2/v3/userinfo',
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    scope: 'openid email profile'
  };
  const GITHUB = {
    auth: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    userinfo: 'https://api.github.com/user',
    emails: 'https://api.github.com/user/emails',
    client_id: process.env.GITHUB_CLIENT_ID || '',
    client_secret: process.env.GITHUB_CLIENT_SECRET || '',
    scope: 'read:user user:email'
  };
  function providerByName(name){ return name==='google'?GOOGLE: name==='github'?GITHUB: null; }

  // Lightweight init that returns where to continue (used by client modal)
  app.get('/unicon/api/oauth/:provider/init', (req, res) => {
    const provider = providerByName(req.params.provider);
    if (!provider || !provider.client_id) return res.status(400).json({ error: 'provider_not_configured' });
    return res.json({ continue_url: `/unicon/api/oauth/${req.params.provider}/start` });
  });

  // Branded local consent before going out to Google/GitHub
  app.get('/unicon/api/oauth/:provider/start', async (req,res) => {
    const provider = providerByName(req.params.provider);
    if (!provider || !provider.client_id) return res.status(400).send('provider_not_configured');
    const state = b64url(crypto.randomBytes(16));
    const verifier = makeVerifier();
    const challenge = makeChallenge(verifier);
    const redirectUri = `${req.protocol}://${req.get('host')}/unicon/api/oauth/${req.params.provider}/callback`;
    pkceStore.set(state, { verifier, provider: req.params.provider, exp: Date.now()+pkceExpireMs, challenge, redirectUri });
    // Per-response CSP nonce for inline <style>
    const styleNonce = crypto.randomBytes(16).toString('base64');
    // Override CSP to avoid 'unsafe-inline' by allowing style nonce for this HTML response only
    const current = (res.getHeader('Content-Security-Policy')||'').toString();
    if (current) {
      const tightened = current.replace("style-src 'self' 'unsafe-inline'", `style-src 'self' 'nonce-${styleNonce}'`)
                               .replace("script-src 'self'", `script-src 'self'`);
      res.setHeader('Content-Security-Policy', tightened);
    }
    const html = `<!doctype html><html><head><meta charset='utf-8'><title>Continue with ${req.params.provider}</title>
      <style nonce='${styleNonce}'>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0}
      .wrap{max-width:560px;margin:10vh auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.06)}
      .hd{padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;gap:8px;align-items:center}
      .bd{padding:24px}
      .btn{display:inline-block;padding:10px 16px;border-radius:6px;text-decoration:none}
      .pri{background:#004b8d;color:#fff}
      .sec{background:#e2e8f0;color:#0f172a;margin-left:8px}
      .muted{color:#475569;font-size:14px}
      </style></head><body>
      <div class='wrap'>
        <div class='hd'><strong>Unicon</strong><span class='muted'>Sign in with ${req.params.provider}</span></div>
        <div class='bd'>
          <p class='muted'>You will be redirected to ${req.params.provider} to continue.</p>
          <div style='margin-top:16px'>
            <a class='btn pri' href='/unicon/api/oauth/${req.params.provider}/continue?state=${encodeURIComponent(state)}'>Continue</a>
            <a class='btn sec' href='/unicon/'>Cancel</a>
          </div>
        </div>
      </div>
      </body></html>`;
    res.setHeader('Content-Type','text/html');
    return res.send(html);
  });

  app.get('/unicon/api/oauth/:provider/continue', (req,res) => {
    const entry = pkceStore.get(req.query.state);
    const provider = providerByName(req.params.provider);
    if (!entry || !provider) return res.status(400).send('invalid_state');
    const params = new URLSearchParams({
      client_id: provider.client_id,
      response_type: 'code',
      redirect_uri: entry.redirectUri,
      scope: provider.scope,
      code_challenge: entry.challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      state: req.query.state
    });
    return res.redirect(`${provider.auth}?${params.toString()}`);
  });

  app.get('/unicon/api/oauth/:provider/callback', async (req,res) => {
    try {
      const provider = providerByName(req.params.provider);
      if (!provider) return res.status(400).send('unknown_provider');
      const { code, state } = req.query || {};
      const entry = pkceStore.get(state); pkceStore.delete(state);
      if (!entry || entry.exp < Date.now()) return res.status(400).send('invalid_state');
      if (entry.provider !== req.params.provider) return res.status(400).send('state_provider_mismatch');
      const redirectUri = `${req.protocol}://${req.get('host')}/unicon/api/oauth/${req.params.provider}/callback`;
      // Exchange code
      const axios = require('axios');
      let tokenResp;
      if (provider === GITHUB) {
        tokenResp = await axios.post(provider.token, new URLSearchParams({
          client_id: provider.client_id,
          client_secret: provider.client_secret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        }), { headers: { Accept: 'application/json' } });
      } else {
        tokenResp = await axios.post(provider.token, new URLSearchParams({
          client_id: provider.client_id,
          client_secret: provider.client_secret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: entry.verifier
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      }
      const accessToken = tokenResp.data.access_token;
      if (!accessToken) return res.status(400).send('token_exchange_failed');
      // Fetch user info
      let email = null; let avatar = null; let providerName = (provider===GOOGLE?'google':'github');
      if (provider === GOOGLE) {
        const u = await axios.get(provider.userinfo, { headers: { Authorization: `Bearer ${accessToken}` } });
        email = u.data?.email; avatar = u.data?.picture || null;
      } else if (provider === GITHUB) {
        const u = await axios.get(provider.userinfo, { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'unicon' } });
        email = u.data?.email; avatar = u.data?.avatar_url || null;
        if (!email) {
          const e = await axios.get(provider.emails, { headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'unicon' } });
          email = (e.data || []).find(x => x.primary)?.email || (e.data[0]?.email);
        }
      }
      if (!email) return res.status(400).send('email_not_found');
      // Provision user and emit local code for client
      if (DB) {
        const dbi = (await buildState()).db;
        if (dbi) {
          let u = await dbi.getUserByEmail(email);
          if (!u) {
            const { v4: uuidv4 } = require('uuid');
            await dbi.createUser({ id: uuidv4(), email, password_hash: 'oauth', salt: 'oauth', createdAt: new Date().toISOString() });
            u = await dbi.getUserByEmail(email);
            await dbi.assignRoleToUser(u.id, 'developer');
          }
          if (avatar) await dbi.setUserPref(u.id, 'avatar', avatar);
          await dbi.setUserPref(u.id, 'provider', providerName);
          if (dbi.upsertOauthAccount) {
            await dbi.upsertOauthAccount({ id: uuidv4(), user_id: u.id, provider: providerName, provider_user_id: email, linked_at: new Date().toISOString() });
          }
        }
      }
      const localCode = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      oauthCodes.set(localCode, { userEmail: email, exp: Date.now() + 5 * 60 * 1000 });
      const clientRedirect = `${req.protocol}://${req.get('host')}/unicon/auth/callback`;
      const sep = clientRedirect.includes('?') ? '&' : '?';
      return res.redirect(`${clientRedirect}${sep}code=${encodeURIComponent(localCode)}&provider=${req.params.provider}`);
    } catch (e) {
      return res.status(500).send('oauth_error');
    }
  });

  // OAuth2 demo endpoints (local only) with minimal consent + PKCE-like state
  const oauthCodes = new Map(); // code -> { userEmail, exp }
  app.get('/unicon/api/oauth/authorize', (req, res) => {
    try {
      const { client_id, redirect_uri, state } = req.query || {};
      const okClient = client_id === 'demo';
      const okRedirect = typeof redirect_uri === 'string' && /\/unicon\/auth\/callback$/.test(redirect_uri);
      if (!okClient || !okRedirect) return res.status(400).send('invalid_client or invalid_redirect');
      // Per-response CSP nonce for inline <style>
      const styleNonce = crypto.randomBytes(16).toString('base64');
      const current = (res.getHeader('Content-Security-Policy')||'').toString();
      if (current) {
        const tightened = current.replace("style-src 'self' 'unsafe-inline'", `style-src 'self' 'nonce-${styleNonce}'`)
                                 .replace("script-src 'self'", `script-src 'self'`);
        res.setHeader('Content-Security-Policy', tightened);
      }
      // Minimal consent HTML with nonce on <style>
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Authorize – Demo</title>
        <style nonce='${styleNonce}'>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f8fafc;color:#0f172a}
        .wrap{max-width:540px;margin:10vh auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.06)}
        .hd{padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px}
        .bd{padding:24px}
        .btn{display:inline-block;padding:10px 16px;border-radius:6px;text-decoration:none}
        .pri{background:#004b8d;color:#fff}
        .sec{background:#e2e8f0;color:#0f172a;margin-left:8px}
        .muted{color:#475569;font-size:14px}
        </style></head><body>
        <div class="wrap">
          <div class="hd"><strong>Unicon Demo OAuth</strong></div>
          <div class="bd">
            <p class="muted">The application <strong>Unicon</strong> is requesting access to your demo account <strong>demo@unicon.local</strong>.</p>
            <ul class="muted"><li>Read profile (email)</li><li>Basic access</li></ul>
            <div style="margin-top:16px">
              <a class="btn pri" href="/unicon/api/oauth/authorize/decision?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${encodeURIComponent(state||'')}&consent=allow">Allow</a>
              <a class="btn sec" href="/unicon/api/oauth/authorize/decision?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${encodeURIComponent(state||'')}&consent=deny">Cancel</a>
            </div>
          </div>
        </div>
        </body></html>`;
      res.setHeader('Content-Type','text/html');
      return res.send(html);
    } catch (e) {
      if (process.env.NODE_ENV === 'test') {
        return res.status(500).send('server_error:' + e.message);
      }
      return res.status(500).send('server_error');
    }
  });
  app.get('/unicon/api/oauth/authorize/decision', (req,res)=>{
    const { client_id, redirect_uri, state, consent } = req.query||{};
    const okClient = client_id === 'demo';
    const okRedirect = typeof redirect_uri === 'string' && /\/unicon\/auth\/callback$/.test(redirect_uri);
    if (!okClient || !okRedirect) return res.status(400).send('invalid_client or invalid_redirect');
    const sep = redirect_uri.includes('?') ? '&' : '?';
    if (consent !== 'allow') return res.redirect(`${redirect_uri}${sep}error=access_denied${state?`&state=${encodeURIComponent(state)}`:''}`);
    const code = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    oauthCodes.set(code, { userEmail: 'demo@unicon.local', exp: Date.now() + 5 * 60 * 1000 });
    return res.redirect(`${redirect_uri}${sep}code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
  });
  app.post('/unicon/api/oauth/token', express.json(), async (req, res) => {
    try {
      const { code, client_id } = req.body || {};
      if (client_id !== 'demo' || !oauthCodes.has(code)) return res.status(400).json({ error: 'invalid_grant' });
      const entry = oauthCodes.get(code); oauthCodes.delete(code);
      if (!entry || entry.exp < Date.now()) return res.status(400).json({ error: 'expired_code' });
      // ensure user exists
      if (DB) {
        const dbi = (await buildState()).db; // reuse init to have db
        if (dbi) {
          let u = await dbi.getUserByEmail(entry.userEmail);
          if (!u) {
            const { v4: uuidv4 } = require('uuid');
            await dbi.createUser({ id: uuidv4(), email: entry.userEmail, password_hash: 'oauth', salt: 'oauth', createdAt: new Date().toISOString() });
            u = await dbi.getUserByEmail(entry.userEmail);
            await dbi.assignRoleToUser(u.id, 'developer');
          }
        }
      }
      const { issueJWT } = require('./auth/middleware');
      const token = issueJWT({ id: entry.userEmail, email: entry.userEmail, roles: ['developer'] });
      return res.json({ access_token: token, token_type: 'Bearer', expires_in: 8 * 60 * 60 });
    } catch (e) {
      if (process.env.NODE_ENV === 'test') {
        return res.status(500).json({ error: 'server_error', detail: e.message });
      }
      return res.status(500).json({ error: 'server_error' });
    }
  });

  // OPC UA quick-monitor endpoints using datasets from Node-RED config
  function loadNodeRedDatasets(){
    try {
      const p = path.join(__dirname, 'nodered', 'opcua-servers.json');
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    } catch { return { servers: [], defaultDatasetId: null }; }
  }
  async function ensureOpcuaConnectionForDataset(datasetId, connections, activeConnections, db){
    const cfg = loadNodeRedDatasets();
    const ds = (cfg.servers||[]).find(s=>s.id===datasetId) || null;
    if (!ds) throw new Error('dataset_not_found');
    const endpointUrl = ds.endpoint;
    // search existing
    let conn = connections.find(c => (c.type==='opcua'||c.type==='opc-ua') && c.config && c.config.endpointUrl===endpointUrl);
    if (!conn){
      conn = normalizeConnection({ id: uuidv4(), name: datasetId, type: 'opcua', config: { endpointUrl, securityMode: ds.securityMode||'None', securityPolicy: ds.securityPolicy||'None', userIdentity: ds.auth||{ type:'anonymous' }, timeoutMs: ds.timeoutMs || 20000 } });
      connections.push(conn);
      await persistConnections(connections, db);
    }
    // connect if needed
    if (conn.status !== 'connected' || !activeConnections.get(conn.id)){
      const handler = new OPCUAHandler(conn.id, conn.config||{});
      await handler.connect();
      conn.status = 'connected';
      activeConnections.set(conn.id, { status:'connected', handler, type: conn.type });
      await persistConnections(connections, db);
      broadcast({ type:'connection_status', data:{ connectionId: conn.id, status:'connected' } });
    }
    return conn;
  }
  apiRouter.post('/opcua/monitor/start', async (req, res) => {
    try {
      const { datasetId, nodeIds, publishingInterval, samplingInterval, queueSize, discardOldest, logPath } = req.body||{};
      if (!datasetId || !Array.isArray(nodeIds) || !nodeIds.length) return res.status(400).json({ success:false, error:'datasetId and nodeIds required' });
      const conn = await ensureOpcuaConnectionForDataset(datasetId, connections, activeConnections, db);
      const active = activeConnections.get(conn.id);
      const result = await active.handler.monitorStart({ nodeIds, options: { publishingInterval, samplingInterval, queueSize, discardOldest, datasetId, logPath } });
      res.json({ success:true, connectionId: conn.id, ...result });
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/opcua/monitor/stop', async (req, res) => {
    try {
      const { connectionId, monitorId } = req.body||{};
      if (!monitorId) return res.status(400).json({ success:false, error:'monitorId required' });
      let handler = null;
      if (connectionId && activeConnections.get(connectionId)) handler = activeConnections.get(connectionId).handler;
      if (!handler){
        for (const [cid, ac] of activeConnections){ if (ac?.handler?._monitors?.has(monitorId)) { handler = ac.handler; break; } }
      }
      if (!handler) return res.status(404).json({ success:false, error:'monitor_not_found' });
      const result = await handler.monitorStop(monitorId);
      res.json(result);
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });
  // Stop monitor and rotate CSV (rename with timestamp), clearing for next run
  apiRouter.post('/opcua/monitor/stop-rotate', async (req, res) => {
    try {
      const { connectionId, monitorId } = req.body||{};
      if (!monitorId) return res.status(400).json({ success:false, error:'monitorId required' });
      let handler = null; let logPath = null;
      for (const [cid, ac] of activeConnections){
        const h = ac?.handler;
        if (h && h._monitors && h._monitors.has(monitorId)) {
          handler = h; logPath = h._monitors.get(monitorId)?.logPath || null; break;
        }
      }
      if (!handler) return res.status(404).json({ success:false, error:'monitor_not_found' });
      const fs = require('fs');
      const path = require('path');
      // Stop first
      await handler.monitorStop(monitorId);
      let rotatedPath = null;
      if (logPath && fs.existsSync(logPath)) {
        const ext = path.extname(logPath);
        const base = logPath.slice(0, -ext.length);
        const ts = new Date().toISOString().replace(/[:.]/g,'-');
        rotatedPath = `${base}-${ts}${ext}`;
        try { fs.renameSync(logPath, rotatedPath); } catch (e) { return res.status(500).json({ success:false, error: 'rotate_failed', detail: e.message }); }
      }
      return res.json({ success:true, rotatedPath });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  // Download CSV for an active monitor (by monitorId)
  apiRouter.get('/opcua/monitor/csv', async (req, res) => {
    try {
      const monitorId = req.query.monitorId;
      if (!monitorId) return res.status(400).send('monitorId required');
      let entry = null;
      for (const [cid, ac] of activeConnections) {
        const h = ac?.handler;
        if (h && h._monitors && h._monitors.has(monitorId)) {
          entry = { handler: h, monitor: h._monitors.get(monitorId), connectionId: cid };
          break;
        }
      }
      if (!entry) return res.status(404).send('monitor not found');
      const fs = require('fs');
      const path = require('path');
      const p = entry.monitor?.logPath;
      if (!p || !fs.existsSync(p)) return res.status(404).send('log not found');
      const filename = path.basename(p);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
      fs.createReadStream(p).pipe(res);
    } catch (e) { res.status(500).send('server error'); }
  });

  // List/download/delete rotated OPC UA logs (CSV) in server/nodered/logs
  apiRouter.get('/opcua/logs', async (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(__dirname, 'nodered', 'logs');
      try { fs.mkdirSync(dir, { recursive: true }); } catch(_){}
      const files = (fs.readdirSync(dir) || []).filter(f => /\.csv$/i.test(f));
      const { connectionId, datasetId, q } = req.query || {};
      const items = [];
      const datasets = new Set();
      for (const name of files) {
        if (connectionId && !name.includes(connectionId)) continue;
        const parts = name.split('-');
        const ds = parts[0] || null;
        const conn = parts.length > 1 ? parts[1] : null;
        if (datasetId && ds !== datasetId) continue;
        if (q && !name.toLowerCase().includes(String(q).toLowerCase())) continue;
        const p = path.join(dir, name);
        let st; try { st = fs.statSync(p); } catch { continue; }
        if (ds) datasets.add(ds);
        items.push({ name, size: st.size, mtime: st.mtimeMs, datasetId: ds, connectionId: conn });
      }
      items.sort((a,b)=> b.mtime - a.mtime);
      const page = Math.max(1, parseInt(req.query.page||'1',10));
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize||'10',10)));
      const total = items.length;
      const start = (page-1) * pageSize;
      const slice = items.slice(start, start + pageSize);
      res.json({ success:true, files: slice, total, page, pageSize, datasets: Array.from(datasets).sort() });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.get('/opcua/logs/download', async (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const name = (req.query.file||'').toString();
      if (!name || /[\\/]/.test(name)) return res.status(400).send('invalid file');
      const p = path.join(__dirname, 'nodered', 'logs', name);
      if (!fs.existsSync(p)) return res.status(404).send('not found');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=\"${name}\"`);
      fs.createReadStream(p).pipe(res);
    } catch (e) { res.status(500).send('server error'); }
  });
  apiRouter.delete('/opcua/logs', async (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const name = (req.body?.file||'').toString();
      if (!name || /[\\/]/.test(name)) return res.status(400).json({ success:false, error:'invalid file' });
      const p = path.join(__dirname, 'nodered', 'logs', name);
      try { fs.unlinkSync(p); } catch (e) { return res.status(500).json({ success:false, error: e.message }); }
      res.json({ success:true });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  // Connect a dataset explicitly (optional)
  apiRouter.post('/opcua/connect', async (req, res) => {
    try {
      const { datasetId } = req.body||{};
      if (!datasetId) return res.status(400).json({ success:false, error:'datasetId required' });
      const conn = await ensureOpcuaConnectionForDataset(datasetId, connections, activeConnections, db);
      res.json({ success:true, connectionId: conn.id });
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });
  // Browse using datasetId (query: datasetId, nodeId)
  apiRouter.get('/opcua/browse', async (req, res) => {
    try {
      const datasetId = req.query.datasetId;
      const nodeId = req.query.nodeId || 'RootFolder';
      if (!datasetId) return res.status(400).json({ success:false, error:'datasetId required' });
      const conn = await ensureOpcuaConnectionForDataset(datasetId, connections, activeConnections, db);
      const active = activeConnections.get(conn.id);
      const out = await active.handler.browse(nodeId);
      res.json(out);
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });
  // Read using datasetId (body: nodes[])
  apiRouter.post('/opcua/read', async (req, res) => {
    try {
      const { datasetId, nodes } = req.body||{};
      if (!datasetId || !Array.isArray(nodes) || !nodes.length) return res.status(400).json({ success:false, error:'datasetId and nodes required' });
      const conn = await ensureOpcuaConnectionForDataset(datasetId, connections, activeConnections, db);
      const active = activeConnections.get(conn.id);
      const out = await active.handler.read(nodes);
      res.json(out);
    } catch(e){ res.status(500).json({ success:false, error: e.message }); }
  });

  // Guess OPC UA endpoints by trying common ports/paths with None/Anonymous
  apiRouter.post('/opcua/guess', async (req, res) => {
    try {
      const { host, ports = [4840,53530], paths = ['/', '/OPCUA/SimulationServer', '/UA/Server', '/blr'], timeoutMs = 4000 } = req.body || {};
      if (!host) return res.status(400).json({ success:false, error:'host required' });
      const tried = [];
      const ok = [];
      for (const port of ports) {
        for (const p of paths) {
          const pathNorm = p.startsWith('/') ? p : `/${p}`;
          const url = `opc.tcp://${host}:${port}${pathNorm}`;
          tried.push(url);
          const h = new OPCUAHandler('guess', { endpointUrl: url, securityMode: 'None', securityPolicy: 'None', timeoutMs });
          try {
            await h.connect();
            ok.push(url);
            await h.disconnect();
          } catch (_) {}
        }
      }
      res.json({ success:true, ok, tried });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  // Tools endpoints (safe wrappers)
  apiRouter.post('/tools/tcp-check', async (req, res) => {
    try {
      const { host, port, timeoutMs = 4000 } = req.body || {};
      if (!host || !port) return res.status(400).json({ success:false, error:'host and port required' });
      const net = require('net');
      const socket = new net.Socket();
      const timer = setTimeout(() => { try { socket.destroy(); } catch(_){} }, Math.max(100, timeoutMs));
      socket.once('error', (e)=>{ clearTimeout(timer); return res.status(200).json({ success:false, reachable:false, error: e.message }); });
      socket.connect(port, host, ()=>{ clearTimeout(timer); try { socket.destroy(); } catch(_){}; return res.json({ success:true, reachable:true }); });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  apiRouter.post('/tools/ping', async (req, res) => {
    try {
      const { host, count = 4, timeoutMs = 12000 } = req.body || {};
      if (!/^[A-Za-z0-9_\-.:]+$/.test(host || '')) return res.status(400).json({ success:false, error:'invalid host' });
      const n = Math.min(Math.max(parseInt(count,10)||4, 1), 10);
      const isWin = process.platform === 'win32';
      const hasIPv6 = /:/.test(host || '');
      const { spawn } = require('child_process');
      const args = [];
      if (isWin) {
        if (hasIPv6) args.push('-6');
        args.push('-n', String(n));
        // Windows timeout is per-echo in ms via -w; keep conservative
        args.push('-w', String(Math.max(1000, Math.min(timeoutMs, 60000))));
        args.push(host);
      } else {
        if (hasIPv6) args.push('-6');
        args.push('-c', String(n));
        // Linux -W expects seconds for each reply timeout
        const per = Math.max(1, Math.min(Math.floor(timeoutMs/1000), 30));
        args.push('-W', String(per));
        args.push(host);
      }
      const child = spawn('ping', args, { shell: isWin, windowsHide: true });
      let out = '';
      let err = '';
      const killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch(_){} }, Math.max(1000, timeoutMs));
      child.stdout.on('data', d => { out += d.toString('utf8'); });
      child.stderr.on('data', d => { err += d.toString('utf8'); });
      child.on('close', (code) => {
        clearTimeout(killTimer);
        if (!out && err) return res.status(500).json({ success:false, error: err.trim() });
        res.json({ success: true, code, output: out || err });
      });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/tools/traceroute', async (req, res) => {
    try {
      const { host, maxHops = 20, timeoutMs = 30000 } = req.body || {};
      if (!/^[A-Za-z0-9_\-.:]+$/.test(host || '')) return res.status(400).json({ success:false, error:'invalid host' });
      const hops = Math.min(Math.max(parseInt(maxHops,10)||20, 1), 64);
      const isWin = process.platform === 'win32';
      const cmd = isWin ? `tracert -d -h ${hops} ${host}` : `traceroute -n -m ${hops} ${host}`;
      const exec = require('child_process').exec;
      exec(cmd, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024*1024 }, (err, stdout='', stderr='') => {
        if (err && !stdout) return res.status(500).json({ success:false, error: err.message, stderr });
        res.json({ success:true, output: String(stdout||stderr) });
      });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  // FTP upload (multipart/form-data)
  apiRouter.post('/ftp/upload', upload.single('file'), async (req, res) => {
    try {
      const connectionId = req.query.connectionId || req.body?.connectionId;
      const remoteDir = req.query.path || req.body?.path || '.';
      if (!req.file) return res.status(400).json({ success: false, error: 'file required' });
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'ftp') return res.status(400).json({ success: false, error: 'FTP connection not active' });
      const remotePath = remoteDir.endsWith('/') ? `${remoteDir}${req.file.originalname}` : `${remoteDir}/${req.file.originalname}`;
      const result = await active.handler.uploadFromBuffer(req.file.buffer, remotePath);
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // FTP download (binary)
  apiRouter.get('/ftp/download', async (req, res) => {
    try {
      const connectionId = req.query.connectionId;
      const remotePath = req.query.path;
      if (!connectionId || !remotePath) return res.status(400).send('connectionId and path required');
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'ftp') return res.status(400).send('FTP connection not active');
      const filename = path.basename(remotePath);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      await active.handler.downloadToStream(res, remotePath);
      res.end();
    } catch (e) {
      res.status(500).send(e.message || 'download error');
    }
  });

  // FTP delete
  apiRouter.post('/ftp/delete', async (req, res) => {
    try {
      const { connectionId, path: p } = req.body || {};
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'ftp') return res.status(400).json({ success: false, error: 'FTP connection not active' });
      const result = await active.handler.remove(p);
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // FTP text helpers (UTF-8)
  apiRouter.get('/ftp/text', async (req, res) => {
    try {
      const connectionId = req.query.connectionId;
      const remotePath = req.query.path;
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'ftp') return res.status(400).send('FTP connection not active');
      const buf = await active.handler.downloadToBuffer(remotePath);
      res.json({ success: true, size: buf.length, content: buf.toString('utf8') });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/ftp/text', async (req, res) => {
    try {
      const { connectionId, path: remotePath, content } = req.body || {};
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'ftp') return res.status(400).json({ success: false, error: 'FTP connection not active' });
      const buf = Buffer.from(String(content||''), 'utf8');
      const result = await active.handler.uploadFromBuffer(buf, remotePath);
      res.json(result);
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  // SFTP upload (multipart/form-data)
  apiRouter.post('/sftp/upload', upload.single('file'), async (req, res) => {
    try {
      const connectionId = req.query.connectionId || req.body?.connectionId;
      const remoteDir = req.query.path || req.body?.path || '.';
      if (!req.file) return res.status(400).json({ success: false, error: 'file required' });
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'sftp') return res.status(400).json({ success: false, error: 'SFTP connection not active' });
      const remotePath = remoteDir.endsWith('/') ? `${remoteDir}${req.file.originalname}` : `${remoteDir}/${req.file.originalname}`;
      const result = await active.handler.uploadFromBuffer(req.file.buffer, remotePath);
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // SFTP download (binary)
  apiRouter.get('/sftp/download', async (req, res) => {
    try {
      const connectionId = req.query.connectionId;
      const remotePath = req.query.path;
      if (!connectionId || !remotePath) return res.status(400).send('connectionId and path required');
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'sftp') return res.status(400).send('SFTP connection not active');
      const filename = path.basename(remotePath);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      await active.handler.downloadToStream(res, remotePath);
      res.end();
    } catch (e) {
      res.status(500).send(e.message || 'download error');
    }
  });

  // SFTP delete
  apiRouter.post('/sftp/delete', async (req, res) => {
    try {
      const { connectionId, path: p } = req.body || {};
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'sftp') return res.status(400).json({ success: false, error: 'SFTP connection not active' });
      const result = await active.handler.remove(p);
      res.json(result);
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // SFTP text helpers (UTF-8)
  apiRouter.get('/sftp/text', async (req, res) => {
    try {
      const connectionId = req.query.connectionId;
      const remotePath = req.query.path;
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'sftp') return res.status(400).send('SFTP connection not active');
      const buf = await active.handler.downloadToBuffer(remotePath);
      res.json({ success: true, size: buf.length, content: buf.toString('utf8') });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/sftp/text', async (req, res) => {
    try {
      const { connectionId, path: remotePath, content } = req.body || {};
      const active = activeConnections.get(connectionId);
      if (!active || active.type !== 'sftp') return res.status(400).json({ success: false, error: 'SFTP connection not active' });
      const buf = Buffer.from(String(content||''), 'utf8');
      const result = await active.handler.uploadFromBuffer(buf, remotePath);
      res.json(result);
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });

  // FTP utilities end
  apiRouter.post('/tools/dns', async (req, res) => {
    try {
      const { name, rrtype = 'A', timeoutMs = 8000 } = req.body || {};
      if (!/^[A-Za-z0-9_.\-]+$/.test(name || '')) return res.status(400).json({ success:false, error:'invalid name' });
      const dns = require('dns').promises;
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeoutMs);
      let data;
      try {
        switch (String(rrtype).toUpperCase()) {
          case 'A': data = await dns.resolve4(name); break;
          case 'AAAA': data = await dns.resolve6(name); break;
          case 'TXT': data = await dns.resolveTxt(name); break;
          case 'CNAME': data = await dns.resolveCname(name); break;
          case 'MX': data = await dns.resolveMx(name); break;
          case 'NS': data = await dns.resolveNs(name); break;
          case 'SRV': data = await dns.resolveSrv(name); break;
          default: return res.status(400).json({ success:false, error:'unsupported rrtype' });
        }
      } finally { clearTimeout(to); }
      res.json({ success:true, name, rrtype: String(rrtype).toUpperCase(), data });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });
  apiRouter.post('/tools/http-echo', async (req, res) => {
    try {
      const headers = Object.fromEntries(Object.entries(req.headers || {}).filter(([k]) => !/^(cookie|authorization)$/i.test(k)));
      res.json({ success:true, method: req.method, headers, body: req.body });
    } catch (e) { res.status(500).json({ success:false, error: e.message }); }
  });


  const builtIndex = path.join(__dirname, 'public', 'index.html');
  const hasBuiltClient = fs.existsSync(builtIndex);
  if (hasBuiltClient) {
    app.use('/unicon', express.static(path.join(__dirname, 'public')));

    app.get('/unicon/*', (req, res) => {
      try {
        let html = fs.readFileSync(builtIndex, 'utf8');
        // inject a tiny inline script with a nonce (for CSP verification in prod)
        const nonce = crypto.randomBytes(16).toString('base64');
        const current = (res.getHeader('Content-Security-Policy')||'').toString();
        const updated = current.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`)
                               .replace("style-src 'self' 'unsafe-inline'", "style-src 'self'");
        res.setHeader('Content-Security-Policy', updated);
        html = html.replace('</head>', `<script nonce=\"${nonce}\">window.__csp=1</script></head>`);
        res.setHeader('Content-Type','text/html');
        res.send(html);
      } catch (e) {
        try { console.error('UI render failed:', e && e.message ? e.message : e); } catch(_){}
        try { return res.sendFile(builtIndex); } catch (_) {}
        res.status(500).send('Failed to load UI');
      }
    });
  }

  app.get('/', (req, res) => {
    res.json({
      message: 'Universal Protocol Test Client Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  return app;
};

const createWebSocketServer = (connectedClients, customPort = WS_PORT, activeConnections = null) => {
  const keyPath = process.env.HTTPS_KEY_FILE;
  const certPath = process.env.HTTPS_CERT_FILE;
  let wsServer;
  if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsServer = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) });
    wsServer = new WebSocket.Server({ server: httpsServer });
    httpsServer.listen(customPort, '0.0.0.0', () => {
      console.log(`🔐 WSS Server running on port ${customPort}`);
    });
  } else {
    wsServer = new WebSocket.Server({ port: customPort, host: '0.0.0.0' });
  }

  wsServer.on('connection', ws => {
    connectedClients.add(ws);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg && msg.type === 'sshInput' && activeConnections) {
          const { connectionId, sessionId, data: payload } = msg.data || {};
          const active = activeConnections.get(connectionId);
          if (active && active.type === 'ssh' && active.handler && sessionId && typeof active.handler.shellInput === 'function') {
            try { await active.handler.shellInput({ sessionId, data: payload }); } catch (_) {}
          }
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
    });

    ws.on('error', error => {
      console.error('WebSocket error:', error);
      connectedClients.delete(ws);
    });

    ws.send(JSON.stringify({
      type: 'connection_status',
      data: { status: 'connected', timestamp: new Date().toISOString() }
    }));
  });

  return wsServer;
};

let __RUNNING = { server: null, wsServer: null };

const net = require('net');
async function waitPortFree(port, host='0.0.0.0', attempts=10, delayMs=200) {
  for (let i=0;i<attempts;i++) {
    const ok = await new Promise((resolve) => {
      const s = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => { s.close(()=>resolve(true)); })
        .listen(port, host);
    });
    if (ok) return true;
    await new Promise(r=>setTimeout(r, delayMs));
  }
  return false;
}

const startServers = async (state) => {
  // Ensure only one instance is running (helps Jest suites reusing the same ports)
  if (__RUNNING.server) {
    try { __RUNNING.wsServer && __RUNNING.wsServer.close(); } catch {}
    try { await new Promise(res => __RUNNING.server.close(() => res(null))); } catch {}
    __RUNNING = { server: null, wsServer: null };
  }

  let resolvedState = state;
  let appState;
  if (!resolvedState) {
    appState = await buildState();
  } else if (typeof resolvedState.then === 'function') {
    // Start quickly with a placeholder state; merge real state when ready
    appState = { connections: [], activeConnections: new Map(), connectedClients: new Set(), db: null };
    resolvedState.then(real => {
      try {
        // merge into the objects captured by the app closures
        appState.connections.splice(0, appState.connections.length, ...real.connections);
        appState.db = real.db;
      } catch {}
    }).catch(()=>{});
  } else {
    appState = resolvedState;
  }

  const app = createApp(appState);
  // Choose free ports in test mode to avoid collisions
  let httpPort = Number(process.env.PORT) || PORT;
  let wsPort = Number(process.env.WS_PORT) || WS_PORT;
  const IN_TEST = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
  if (IN_TEST) {
    // try up to 10 increments to find a free pair
    for (let i=0;i<10;i++) {
      const okHttp = await waitPortFree(httpPort);
      const okWs = await waitPortFree(wsPort);
      if (okHttp && okWs) break;
      httpPort += 1; wsPort += 1;
    }
    process.env.PORT = String(httpPort);
    process.env.WS_PORT = String(wsPort);
  }
  const wsServer = createWebSocketServer(appState.connectedClients, wsPort, appState.activeConnections);
  const http = require('http');
  const server = http.createServer(app);

  // Optionally embed Node-RED runtime under /unicon/flows (admin) and /unicon/flows/api (HTTP nodes)
  const ENABLE_NODERED = (process.env.FEATURE_NODERED || '1') !== '0';
  if (ENABLE_NODERED) {
    try {
      const RED = require('node-red');
      const nrUserDir = path.join(__dirname, 'nodered');
      try { fs.mkdirSync(nrUserDir, { recursive: true }); } catch (_) {}
      const nrSettings = {
        httpAdminRoot: '/unicon/flows',
        httpNodeRoot: '/unicon/flows/api',
        userDir: nrUserDir,
        flowFile: 'flows.json',
        functionGlobalContext: {
          jwt: require('jsonwebtoken'),
          jwtSecret: process.env.NR_JWT_SECRET || 'change-me',
          opcuaServers: (() => { try { return require(path.join(nrUserDir, 'opcua-servers.json')); } catch { return { servers: [], defaultDatasetId: null }; } })(),
          apiUsers: (() => { try { return require(path.join(nrUserDir, 'api-users.json')); } catch { return null; } })()
        },
        // Allow loading contrib nodes from the server-level node_modules to avoid duplicate installs
        nodesDir: [ path.join(__dirname, 'node_modules') ]
      };
      RED.init(server, nrSettings);
      app.use(nrSettings.httpAdminRoot, RED.httpAdmin);
      app.use(nrSettings.httpNodeRoot, RED.httpNode);
      // Start Node-RED asynchronously; do not block app startup
      RED.start().then(()=>console.log('🧩 Node-RED embedded at /unicon/flows')).catch(e => console.error('Node-RED failed to start:', e?.message || e));
    } catch (e) {
      console.warn('Node-RED not installed; skipping embed:', e && e.message ? e.message : e);
    }
  } else {
    console.log('⏭️  Skipping Node-RED embed (FEATURE_NODERED=0)');
  }

  await new Promise((resolve) => server.listen(httpPort, '0.0.0.0', resolve));
  console.log(`🚀 HTTP Server running on port ${httpPort}`);
  console.log(`📡 WebSocket Server running on port ${wsPort}`);
  console.log(`🌐 API available at http://localhost:${httpPort}/unicon/api`);
  app.locals.__ready = true;

  const shutdown = () => {
    wsServer.close();
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  __RUNNING = { server, wsServer };
  return { app, server, wsServer, state };
};

if (require.main === module) {
  startServers();
}

module.exports = {
  createApp,
  createWebSocketServer,
  startServers,
  buildState,
  parseAllowedOrigins
};
