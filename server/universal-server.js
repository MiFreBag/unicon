const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const EnhancedRestHandler = require('./handlers/enhanced_rest_handler');
let verifyJWTMiddleware = null;
try { verifyJWTMiddleware = require('./auth/middleware').verifyJWT; } catch (_) { /* auth not enabled */ }
const K8sHandler = require('./handlers/k8s_handler');
const WSHandler = require('./handlers/ws_handler');
const SQLHandler = require('./handlers/sql_handler');
const SSHHandler = require('./handlers/ssh_handler');
const OPCUAHandler = require('./handlers/opcua_handler');
const GrpcHandler = require('./handlers/grpc_handler');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost',
  'http://localhost:80',
  'http://localhost:4173',
  'http://localhost:5174',
  'http://10.1.3.231:5174',
  'http://127.0.0.1',
  'http://127.0.0.1:80'
];

const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;
const DATA_DIR = process.env.CONNECTION_DATA_DIR || path.join(__dirname, 'data');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'connections.json');
const PERSISTENCE = process.env.PERSISTENCE || 'file';
const SQLITE_DB_PATH = path.join(DATA_DIR, 'unicon.db');

const parseAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];

  return envOrigins.length > 0 ? envOrigins : DEFAULT_ALLOWED_ORIGINS;
};

const ensureDataStore = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const normalizeConnection = (connection) => ({
  id: connection.id || uuidv4(),
  name: connection.name || 'Unbenannte Verbindung',
  type: connection.type || 'unknown',
  config: connection.config || {},
  createdAt: connection.createdAt || new Date().toISOString(),
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

const buildState = async () => {
  let db = null;
  if (PERSISTENCE === 'sqlite' && DB) {
    db = await new DB(SQLITE_DB_PATH).init();
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

const createCorsMiddleware = allowedOrigins => cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true
});

const createApp = (state) => {
  const { connections, activeConnections, connectedClients, db } = state;
  const allowedOrigins = parseAllowedOrigins();
  const broadcast = createBroadcast(connectedClients);
  // make broadcast visible to handlers
  global.broadcast = broadcast;

  const app = express();
  app.use(createCorsMiddleware(allowedOrigins));
  app.use(express.json({ limit: '10mb' }));

  // in-memory upload storage for OpenAPI files
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

  const apiRouter = express.Router();

  // Add CSP for production/Electron when serving static /unicon content
  const enableCsp = process.env.ENABLE_CSP === '1' || process.env.ELECTRON === '1' || process.env.NODE_ENV === 'production';
  if (enableCsp) {
    const frameAncestors = process.env.CSP_FRAME_ANCESTORS || "'self'"; // e.g., 'self' or 'none'
    const wsConnect = `ws://localhost:${WS_PORT}`;
    const connectSrc = ["'self'", `http://localhost:${PORT}`, wsConnect, 'http://localhost:5174', 'ws://localhost:5174'].join(' ');
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

  apiRouter.get('/connections', ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next(), async (req, res) => {
    try {
      if (db) {
        const fresh = await db.getConnections();
        connections.splice(0, connections.length, ...fresh);
      }
      res.json({ success: true, connections });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.post('/connections', ENFORCE ? verifyJWTMiddleware : (req,res,next)=>next(), async (req, res) => {
    try {
      const connection = {
        id: uuidv4(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'disconnected'
      };

      connections.push(connection);

      await persistConnections(connections, db);

      broadcast({
        type: 'log',
        data: { message: `Connection "${connection.name}" erstellt`, type: 'success' }
      });

      res.json({ success: true, connection });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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
        handler = new SQLHandler(connection.id, connection.config || {});
        await handler.connect();
      } else if (connection.type === 'opcua' || connection.type === 'opc-ua') {
        handler = new OPCUAHandler(connection.id, connection.config || {});
        await handler.connect();
      } else if (connection.type === 'grpc') {
        handler = new GrpcHandler(connection.id, connection.config || {});
        await handler.connect();
      }

      connection.status = 'connected';
      activeConnections.set(connectionId, { status: 'connected', handler, type: connection.type });

      await persistConnections(connections, db);

      broadcast({ type: 'connection_status', data: { connectionId, status: 'connected' } });
      broadcast({ type: 'log', data: { message: `Verbunden mit ${connection.name}`, type: 'success' } });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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
        try { await active.handler.disconnect(); } catch (_) {}
      }

      connection.status = 'disconnected';
      activeConnections.delete(connectionId);

      await persistConnections(connections, db);

      broadcast({ type: 'connection_status', data: { connectionId, status: 'disconnected' } });
      broadcast({ type: 'log', data: { message: 'Verbindung getrennt', type: 'info' } });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      connections: connections.length,
      activeConnections: activeConnections.size,
      connectedClients: connectedClients.size
    });
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
          case 'write':
            return res.json(await h.write(params.nodeId, params.value, params.dataType));
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
            return res.json(result);
          }
          default:
            return res.status(400).json({ success: false, error: `Unknown WS operation: ${operation}` });
        }
      }

      // SQL operations
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
          default:
            return res.status(400).json({ success: false, error: `Unknown K8s operation: ${operation}` });
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

  // Branded local consent before going out to Google/GitHub
  app.get('/unicon/api/oauth/:provider/start', async (req,res) => {
    const provider = providerByName(req.params.provider);
    if (!provider || !provider.client_id) return res.status(400).send('provider_not_configured');
    const state = b64url(crypto.randomBytes(16));
    const verifier = makeVerifier();
    const challenge = makeChallenge(verifier);
    const redirectUri = `${req.protocol}://${req.get('host')}/unicon/api/oauth/${req.params.provider}/callback`;
    pkceStore.set(state, { verifier, provider: req.params.provider, exp: Date.now()+pkceExpireMs, challenge, redirectUri });
    const html = `<!doctype html><html><head><meta charset='utf-8'><title>Continue with ${req.params.provider}</title>
      <style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0}
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
        let u = await dbi.getUserByEmail(email);
        if (!u) {
          const { v4: uuidv4 } = require('uuid');
          await dbi.createUser({ id: uuidv4(), email, password_hash: 'oauth', salt: 'oauth', createdAt: new Date().toISOString() });
          u = await dbi.getUserByEmail(email);
          await dbi.assignRoleToUser(u.id, 'developer');
        }
        if (avatar) await dbi.setUserPref(u.id || (await dbi.getUserByEmail(email)).id, 'avatar', avatar);
        await dbi.setUserPref(u.id || (await dbi.getUserByEmail(email)).id, 'provider', providerName);
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
    const { client_id, redirect_uri, state } = req.query || {};
    const okClient = client_id === 'demo';
    const okRedirect = typeof redirect_uri === 'string' && /\/unicon\/auth\/callback$/.test(redirect_uri);
    if (!okClient || !okRedirect) return res.status(400).send('invalid_client or invalid_redirect');
    // Minimal consent HTML
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Authorize – Demo</title>
      <style>body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#f8fafc;color:#0f172a}
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
        const db = (await buildState()).db; // reuse init to have db
        let u = await db.getUserByEmail(entry.userEmail);
        if (!u) {
          const { v4: uuidv4 } = require('uuid');
          await db.createUser({ id: uuidv4(), email: entry.userEmail, password_hash: 'oauth', salt: 'oauth', createdAt: new Date().toISOString() });
          u = await db.getUserByEmail(entry.userEmail);
          await db.assignRoleToUser(u.id, 'developer');
        }
      }
      const { issueJWT } = require('./auth/middleware');
      const token = issueJWT({ id: entry.userEmail, email: entry.userEmail, roles: ['developer'] });
      return res.json({ access_token: token, token_type: 'Bearer', expires_in: 8 * 60 * 60 });
    } catch (e) { return res.status(500).json({ error: 'server_error' }); }
  });

  app.use('/unicon/api', apiRouter);

  app.use('/unicon', express.static(path.join(__dirname, 'public')));

  app.get('/unicon/*', (req, res) => {
    try {
      const file = path.join(__dirname, 'public', 'index.html');
      let html = fs.readFileSync(file, 'utf8');
      // inject a tiny inline script with a nonce (for CSP verification in prod)
      const nonce = crypto.randomBytes(16).toString('base64');
      res.setHeader('Content-Security-Policy', (res.getHeader('Content-Security-Policy')||'').toString().replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`));
      html = html.replace('</head>', `<script nonce="${nonce}">window.__csp=1</script></head>`);
      res.setHeader('Content-Type','text/html');
      res.send(html);
    } catch (e) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });

  app.get('/', (req, res) => {
    res.json({
      message: 'Universal Protocol Test Client Backend',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  return app;
};

const createWebSocketServer = (connectedClients, customPort = WS_PORT) => {
  const wsServer = new WebSocket.Server({
    port: customPort,
    host: '0.0.0.0'
  });

  wsServer.on('connection', ws => {
    connectedClients.add(ws);

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

const startServers = async (state) => {
  // Ensure only one instance is running (helps Jest suites reusing the same ports)
  if (__RUNNING.server) {
    try { __RUNNING.wsServer && __RUNNING.wsServer.close(); } catch {}
    try { await new Promise(res => __RUNNING.server.close(() => res(null))); } catch {}
    __RUNNING = { server: null, wsServer: null };
  }
  let resolvedState = state;
  if (!resolvedState) {
    resolvedState = await buildState();
  } else if (typeof resolvedState.then === 'function') {
    resolvedState = await resolvedState;
  }
  const app = createApp(resolvedState);
  const httpPort = Number(process.env.PORT) || PORT;
  const wsPort = Number(process.env.WS_PORT) || WS_PORT;
  const wsServer = createWebSocketServer(resolvedState.connectedClients, wsPort);
  const server = app.listen(httpPort, '0.0.0.0', () => {
    console.log(`🚀 HTTP Server running on port ${httpPort}`);
    console.log(`📡 WebSocket Server running on port ${wsPort}`);
    console.log(`🌐 API available at http://localhost:${httpPort}/unicon/api`);
  });

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
