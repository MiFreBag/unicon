const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

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

const loadConnectionsFromFile = () => {
  try {
    ensureDataStore();

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

const persistConnections = async (connections) => {
  ensureDataStore();

  const payload = {
    connections: connections.map(normalizeConnection)
  };

  await fs.promises.writeFile(CONNECTIONS_FILE, JSON.stringify(payload, null, 2), 'utf8');
};

const buildState = () => ({
  connections: loadConnectionsFromFile(),
  activeConnections: new Map(),
  connectedClients: new Set()
});

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

const createApp = (state = buildState()) => {
  const { connections, activeConnections, connectedClients } = state;
  const allowedOrigins = parseAllowedOrigins();
  const broadcast = createBroadcast(connectedClients);

  const app = express();
  app.use(createCorsMiddleware(allowedOrigins));
  app.use(express.json());

  const apiRouter = express.Router();

  apiRouter.get('/connections', (req, res) => {
    try {
      res.json({ success: true, connections });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.post('/connections', async (req, res) => {
    try {
      const connection = {
        id: uuidv4(),
        ...req.body,
        createdAt: new Date().toISOString(),
        status: 'disconnected'
      };

      connections.push(connection);

      await persistConnections(connections);

      broadcast({
        type: 'log',
        data: { message: `Connection "${connection.name}" erstellt`, type: 'success' }
      });

      res.json({ success: true, connection });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.delete('/connections/:id', async (req, res) => {
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

      await persistConnections(connections);

      broadcast({
        type: 'log',
        data: { message: 'Connection gelöscht', type: 'info' }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.post('/connect', async (req, res) => {
    try {
      const { connectionId } = req.body;
      const connection = connections.find(c => c.id === connectionId);

      if (!connection) {
        return res.status(404).json({ success: false, error: 'Connection not found' });
      }

      connection.status = 'connected';
      activeConnections.set(connectionId, { status: 'connected' });

      await persistConnections(connections);

      broadcast({
        type: 'connection_status',
        data: { connectionId, status: 'connected' }
      });

      broadcast({
        type: 'log',
        data: { message: `Verbunden mit ${connection.name}`, type: 'success' }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  apiRouter.post('/disconnect', async (req, res) => {
    try {
      const { connectionId } = req.body;
      const connection = connections.find(c => c.id === connectionId);

      if (!connection) {
        return res.status(404).json({ success: false, error: 'Connection not found' });
      }

      connection.status = 'disconnected';
      activeConnections.delete(connectionId);

      await persistConnections(connections);

      broadcast({
        type: 'connection_status',
        data: { connectionId, status: 'disconnected' }
      });

      broadcast({
        type: 'log',
        data: { message: 'Verbindung getrennt', type: 'info' }
      });

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

  apiRouter.get('/connections/export', (req, res) => {
    try {
      res.setHeader('Content-Disposition', 'attachment; filename="connections-export.json"');
      res.json({ success: true, connections: connections.map(normalizeConnection) });
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

      await persistConnections(connections);

      broadcast({
        type: 'log',
        data: { message: `Importierte ${importedConnections.length} Connections`, type: 'success' }
      });

      res.json({ success: true, connections: importedConnections, count: importedConnections.length });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.use('/unicon/api', apiRouter);

  app.use('/unicon', express.static(path.join(__dirname, 'public')));

  app.get('/unicon/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

const startServers = (state = buildState()) => {
  const app = createApp(state);
  const wsServer = createWebSocketServer(state.connectedClients, WS_PORT);
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTP Server running on port ${PORT}`);
    console.log(`📡 WebSocket Server running on port ${WS_PORT}`);
    console.log(`🌐 API available at http://localhost:${PORT}/unicon/api`);
  });

  const shutdown = () => {
    wsServer.close();
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

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
