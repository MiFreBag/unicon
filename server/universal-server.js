// universal-server.js
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Protocol-specific imports
const { 
  OPCUAClient, 
  MessageSecurityMode, 
  SecurityPolicy,
  AttributeIds,
  ClientSubscription,
  TimestampsToReturn,
  ClientMonitoredItem
} = require('node-opcua');

// Additional protocol dependencies (install as needed)
const axios = require('axios');
const mysql = require('mysql2/promise');
const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 3099;
const WS_PORT = process.env.WS_PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CLIENT_DIST_PATH = path.join(__dirname, '..', 'client', 'dist');

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error);

// Middleware
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use('/unicon', express.static(CLIENT_DIST_PATH));

// Global state
let wsServer = null;
let connectedClients = new Set();
let activeConnections = new Map(); // connectionId -> connection instance
let connectionSubscriptions = new Map(); // connectionId -> subscriptions

// Connection storage
const CONNECTIONS_FILE = path.join(DATA_DIR, 'connections.json');
const connAdapter = new FileSync(CONNECTIONS_FILE);
const connDb = low(connAdapter);
connDb.defaults({ connections: [] }).write();

// Connection manager
const connectionManager = {
  getAll: () => connDb.get('connections').value(),
  
  get: (id) => connDb.get('connections').find({ id }).value(),
  
  add: (connection) => {
    const newConnection = {
      id: uuidv4(),
      ...connection,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    connDb.get('connections')
      .push(newConnection)
      .write();
      
    return newConnection;
  },
  
  update: (id, updates) => {
    const updated = connDb.get('connections')
      .find({ id })
      .assign({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .write();
      
    return updated;
  },
  
  delete: (id) => {
    const removed = connDb.get('connections')
      .remove({ id })
      .write();
      
    return removed.length > 0;
  }
};

// WebSocket server setup
function setupWebSocketServer() {
  wsServer = new WebSocket.Server({ port: WS_PORT });
  
  wsServer.on('connection', (ws) => {
    console.log('Client WebSocket connected');
    connectedClients.add(ws);
    
    ws.on('close', () => {
      console.log('Client WebSocket disconnected');
      connectedClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectedClients.delete(ws);
    });
    
    // Send initial connection status
    ws.send(JSON.stringify({
      type: 'connection_status',
      data: { status: 'connected' }
    }));
  });
  
  console.log(`WebSocket Server running on port ${WS_PORT}`);
}

// Broadcast function
function broadcast(message) {
  const messageStr = JSON.stringify(message);
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

function createLogMessage(message, type = 'info') {
  return {
    type: 'log',
    data: {
      message,
      type,
      timestamp: new Date().toISOString()
    }
  };
}

// Protocol Handlers

class OpcUaHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config;
    this.client = null;
    this.session = null;
    this.subscription = null;
  }

  async connect() {
    try {
      this.client = OPCUAClient.create({
        applicationName: "Universal Test Client",
        connectionStrategy: {
          maxRetry: 1,
          initialDelay: 2000,
          maxDelay: 10000
        },
        securityMode: MessageSecurityMode[this.config.securityMode] || MessageSecurityMode.None,
        securityPolicy: SecurityPolicy[this.config.securityPolicy] || SecurityPolicy.None,
        endpoint_must_exist: false
      });

      await this.client.connect(this.config.endpoint);
      this.session = await this.client.createSession();
      
      return { success: true, message: 'Connected to OPC UA server' };
      
    } catch (error) {
      throw new Error(`OPC UA connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    const result = { success: true, message: 'Disconnected from OPC UA server' };
    
    try {
      if (this.subscription) {
        await this.subscription.terminate();
        this.subscription = null;
      }
      
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
    } catch (error) {
      console.warn('Error during OPC UA disconnect:', error);
    }
    
    return result;
  }

  async browse(nodeId = 'ns=0;i=85') {
    if (!this.session) {
      throw new Error('Not connected to OPC UA server');
    }

    try {
      const browseResult = await this.session.browse(nodeId);
      
      const nodes = browseResult.references.map(ref => ({
        nodeId: ref.nodeId.toString(),
        browseName: ref.browseName.toString(),
        displayName: ref.displayName?.text || ref.browseName.toString(),
        nodeClass: ref.nodeClass,
        typeDefinition: ref.typeDefinition?.toString()
      }));

      return { success: true, data: nodes };
      
    } catch (error) {
      throw new Error(`Browse failed: ${error.message}`);
    }
  }

  async read(nodeId) {
    if (!this.session) {
      throw new Error('Not connected to OPC UA server');
    }

    try {
      const dataValue = await this.session.read({
        nodeId,
        attributeId: AttributeIds.Value
      });

      return {
        success: true,
        data: {
          nodeId,
          value: dataValue.value?.value,
          dataType: dataValue.value?.dataType?.name,
          statusCode: dataValue.statusCode?.name,
          timestamp: dataValue.sourceTimestamp,
          quality: dataValue.statusCode?.description
        }
      };
      
    } catch (error) {
      throw new Error(`Read failed: ${error.message}`);
    }
  }

  async write(nodeId, value, dataType) {
    if (!this.session) {
      throw new Error('Not connected to OPC UA server');
    }

    try {
      const statusCode = await this.session.write({
        nodeId,
        attributeId: AttributeIds.Value,
        value: {
          value,
          dataType: dataType || 'String'
        }
      });

      return {
        success: statusCode.isGood(),
        data: {
          nodeId,
          statusCode: statusCode.name,
          description: statusCode.description
        }
      };
      
    } catch (error) {
      throw new Error(`Write failed: ${error.message}`);
    }
  }
}

class RestHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config;
    this.axiosInstance = null;
  }

  async connect() {
    try {
      this.axiosInstance = axios.create({
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout || 30000,
        headers: this.buildHeaders()
      });

      // Test connection with a simple request
      const testEndpoint = this.config.testEndpoint || '/';
      try {
        await this.axiosInstance.get(testEndpoint);
      } catch (error) {
        // If test endpoint fails, still consider connection successful
        // as the base URL might be valid but test endpoint might not exist
        console.warn('Test endpoint failed, but connection established');
      }

      return { success: true, message: 'REST client configured' };
      
    } catch (error) {
      throw new Error(`REST connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    this.axiosInstance = null;
    return { success: true, message: 'REST client disconnected' };
  }

  async request(method, endpoint, data = null, headers = {}) {
    if (!this.axiosInstance) {
      throw new Error('REST client not connected');
    }

    try {
      const config = {
        method: method.toLowerCase(),
        url: endpoint,
        headers: { ...this.buildHeaders(), ...headers }
      };

      if (data && ['post', 'put', 'patch'].includes(config.method)) {
        config.data = data;
      }

      const response = await this.axiosInstance.request(config);
      
      return {
        success: true,
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      }
    };
  }

  buildHeaders() {
    const headers = {};
    
    if (this.config.headers) {
      try {
        Object.assign(headers, JSON.parse(this.config.headers));
      } catch (error) {
        console.warn('Invalid headers JSON:', error);
      }
    }
    
    switch (this.config.authentication) {
      case 'Bearer Token':
        if (this.config.token) {
          headers['Authorization'] = `Bearer ${this.config.token}`;
        }
        break;
      case 'API Key':
        if (this.config.token) {
          headers['X-API-Key'] = this.config.token;
        }
        break;
      case 'Basic Auth':
        if (this.config.token) {
          headers['Authorization'] = `Basic ${Buffer.from(this.config.token).toString('base64')}`;
        }
        break;
    }
    
    return headers;
  }
}

class WebSocketHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config;
    this.ws = null;
    this.heartbeatInterval = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        const protocols = this.config.protocol ? [this.config.protocol] : undefined;
        this.ws = new WebSocket(this.config.url, protocols);

        this.ws.on('open', () => {
          console.log(`WebSocket connected: ${this.config.url}`);
          
          // Setup heartbeat if configured
          if (this.config.heartbeat && this.config.heartbeat > 0) {
            this.heartbeatInterval = setInterval(() => {
              if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
              }
            }, this.config.heartbeat);
          }

          resolve({ success: true, message: 'WebSocket connected' });
        });

        this.ws.on('message', (data) => {
          broadcast({
            type: 'data',
            data: {
              connectionId: this.connectionId,
              type: 'message',
              data: data.toString(),
              timestamp: new Date().toISOString()
            }
          });
        });

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          reject(new Error(`WebSocket connection failed: ${error.message}`));
        });

        this.ws.on('close', () => {
          console.log('WebSocket disconnected');
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
        });

      } catch (error) {
        reject(new Error(`WebSocket setup failed: ${error.message}`));
      }
    });
  }

  async disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    return { success: true, message: 'WebSocket disconnected' };
  }

  async send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    try {
      this.ws.send(message);
      return { success: true, message: 'Message sent' };
    } catch (error) {
      throw new Error(`Send failed: ${error.message}`);
    }
  }
}

class SqlHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config;
    this.connection = null;
  }

  async connect() {
    try {
      switch (this.config.type.toLowerCase()) {
        case 'postgresql':
          this.connection = new Client({
            host: this.config.host,
            port: this.config.port || 5432,
            database: this.config.database,
            user: this.config.username,
            password: this.config.password,
          });
          await this.connection.connect();
          break;

        case 'mysql':
          this.connection = await mysql.createConnection({
            host: this.config.host,
            port: this.config.port || 3306,
            database: this.config.database,
            user: this.config.username,
            password: this.config.password,
          });
          break;

        case 'sqlite':
          this.connection = new sqlite3.Database(this.config.database);
          break;

        default:
          throw new Error(`Unsupported database type: ${this.config.type}`);
      }

      return { success: true, message: `Connected to ${this.config.type} database` };
      
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        switch (this.config.type.toLowerCase()) {
          case 'postgresql':
            await this.connection.end();
            break;
          case 'mysql':
            await this.connection.end();
            break;
          case 'sqlite':
            this.connection.close();
            break;
        }
        this.connection = null;
      }

      return { success: true, message: 'Database disconnected' };
      
    } catch (error) {
      console.warn('Error during database disconnect:', error);
      return { success: true, message: 'Database disconnected with warnings' };
    }
  }

  async query(sql, params = []) {
    if (!this.connection) {
      throw new Error('Database not connected');
    }

    try {
      let result;
      
      switch (this.config.type.toLowerCase()) {
        case 'postgresql':
          result = await this.connection.query(sql, params);
          return { 
            success: true, 
            data: result.rows,
            rowCount: result.rowCount,
            fields: result.fields?.map(f => f.name) || []
          };

        case 'mysql':
          const [rows, fields] = await this.connection.execute(sql, params);
          return { 
            success: true, 
            data: rows,
            rowCount: rows.length,
            fields: fields.map(f => f.name)
          };

        case 'sqlite':
          return new Promise((resolve, reject) => {
            if (sql.trim().toLowerCase().startsWith('select')) {
              this.connection.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve({ 
                  success: true, 
                  data: rows,
                  rowCount: rows.length,
                  fields: rows.length > 0 ? Object.keys(rows[0]) : []
                });
              });
            } else {
              this.connection.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ 
                  success: true, 
                  data: [],
                  rowCount: this.changes,
                  lastInsertId: this.lastID
                });
              });
            }
          });

        default:
          throw new Error(`Query not supported for ${this.config.type}`);
      }
      
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  async getSchema() {
    try {
      let schemaQuery;
      
      switch (this.config.type.toLowerCase()) {
        case 'postgresql':
          schemaQuery = `
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
          `;
          break;
          
        case 'mysql':
          schemaQuery = `
            SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = DATABASE()
            ORDER BY table_name, ordinal_position
          `;
          break;
          
        case 'sqlite':
          // SQLite needs special handling
          const tables = await this.query("SELECT name FROM sqlite_master WHERE type='table'");
          const schema = [];
          
          for (const table of tables.data) {
            const tableInfo = await this.query(`PRAGMA table_info(${table.name})`);
            schema.push(...tableInfo.data.map(col => ({
              table_name: table.name,
              column_name: col.name,
              data_type: col.type,
              is_nullable: col.notnull === 0 ? 'YES' : 'NO',
              column_default: col.dflt_value
            })));
          }
          
          return { success: true, data: schema };
          
        default:
          throw new Error(`Schema introspection not supported for ${this.config.type}`);
      }
      
      const result = await this.query(schemaQuery);
      return result;
    } catch (error) {
      throw new Error(`Schema query failed: ${error.message}`);
    }
  }
}

// API Routes - Updated with /unicon prefix

// Get all connections
app.get('/unicon/api/connections', (req, res) => {
  try {
    const connections = connectionManager.getAll();
    res.json({ success: true, connections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new connection
app.post('/unicon/api/connections', (req, res) => {
  try {
    const connection = connectionManager.add(req.body);
    broadcast(createLogMessage(`Connection "${connection.name}" erstellt`, 'success'));
    res.json({ success: true, connection });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update connection
app.put('/unicon/api/connections/:id', (req, res) => {
  try {
    const connection = connectionManager.update(req.params.id, req.body);
    if (connection) {
      res.json({ success: true, connection });
    } else {
      res.status(404).json({ error: 'Connection not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete connection
app.delete('/unicon/api/connections/:id', (req, res) => {
  try {
    const connectionId = req.params.id;
    
    // Disconnect if active
    if (activeConnections.has(connectionId)) {
      const handler = activeConnections.get(connectionId);
      handler.disconnect().catch(console.error);
      activeConnections.delete(connectionId);
    }
    
    const deleted = connectionManager.delete(connectionId);
    if (deleted) {
      broadcast(createLogMessage('Connection gelöscht', 'info'));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Connection not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect to service
app.post('/unicon/api/connect', async (req, res) => {
  try {
    const { connectionId } = req.body;
    const connection = connectionManager.get(connectionId);
    
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    if (activeConnections.has(connectionId)) {
      return res.status(400).json({ error: 'Already connected' });
    }
    
    let handler;
    
    switch (connection.type) {
      case 'opc-ua':
        handler = new OpcUaHandler(connectionId, connection.config);
        break;
      case 'rest':
        handler = new RestHandler(connectionId, connection.config);
        break;
      case 'websocket':
        handler = new WebSocketHandler(connectionId, connection.config);
        break;
      case 'sql':
        handler = new SqlHandler(connectionId, connection.config);
        break;
      default:
        return res.status(400).json({ error: `Unsupported connection type: ${connection.type}` });
    }
    
    const result = await handler.connect();
    activeConnections.set(connectionId, handler);
    
    broadcast(createLogMessage(`Verbunden mit ${connection.name}`, 'success'));
    res.json(result);
    
  } catch (error) {
    broadcast(createLogMessage(`Verbindung fehlgeschlagen: ${error.message}`, 'error'));
    res.status(500).json({ error: error.message });
  }
});

// Disconnect from service
app.post('/unicon/api/disconnect', async (req, res) => {
  try {
    const { connectionId } = req.body;
    const handler = activeConnections.get(connectionId);
    
    if (!handler) {
      return res.status(400).json({ error: 'Not connected' });
    }
    
    const result = await handler.disconnect();
    activeConnections.delete(connectionId);
    
    broadcast(createLogMessage('Verbindung getrennt', 'info'));
    res.json(result);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protocol-specific operations
app.post('/unicon/api/operation', async (req, res) => {
  try {
    const { connectionId, operation, params } = req.body;
    const handler = activeConnections.get(connectionId);
    
    if (!handler) {
      return res.status(400).json({ error: 'Not connected' });
    }
    
    let result;
    
    switch (operation) {
      // OPC UA operations
      case 'browse':
        result = await handler.browse(params.nodeId);
        break;
      case 'read':
        result = await handler.read(params.nodeId);
        break;
      case 'write':
        result = await handler.write(params.nodeId, params.value, params.dataType);
        break;
        
      // REST operations
      case 'request':
        result = await handler.request(params.method, params.endpoint, params.data, params.headers);
        break;
        
      // WebSocket operations
      case 'send':
        result = await handler.send(params.message);
        break;
        
      // SQL operations
      case 'query':
        result = await handler.query(params.sql, params.params);
        break;
        
      default:
        return res.status(400).json({ error: `Unsupported operation: ${operation}` });
    }
    
    res.json(result);
    
  } catch (error) {
    broadcast(createLogMessage(`Operation fehlgeschlagen: ${error.message}`, 'error'));
    res.status(500).json({ error: error.message });
  }
});

// Get connection status
app.get('/unicon/api/status/:connectionId', (req, res) => {
  const connectionId = req.params.connectionId;
  const isActive = activeConnections.has(connectionId);
  
  res.json({
    connectionId,
    status: isActive ? 'connected' : 'disconnected',
    active: isActive
  });
});

// Serve built frontend if available, otherwise show helpful message
app.get('/unicon/*', async (req, res) => {
  const indexPath = path.join(CLIENT_DIST_PATH, 'index.html');
  try {
    await fs.access(indexPath);
    res.sendFile(indexPath);
  } catch {
    res
      .status(404)
      .send(
        'Frontend build not found. Run "npm run build" inside unicon/client.'
      );
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: error.message 
  });
});

// Start servers
app.listen(PORT, () => {
  console.log(`Universal Protocol Backend running on port ${PORT}`);
});

setupWebSocketServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  try {
    // Disconnect all active connections
    for (const [connectionId, handler] of activeConnections) {
      try {
        await handler.disconnect();
      } catch (error) {
        console.error(`Error disconnecting ${connectionId}:`, error);
      }
    }
    
    if (wsServer) {
      wsServer.close();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

module.exports = app;