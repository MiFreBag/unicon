// universal-server.js - Korrigierte Backend-Konfiguration
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5174', 'http://10.1.3.231:5174'],
  credentials: true
}));
app.use(express.json());

// Basic configuration
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;

// In-memory storage for connections (in production use database)
let connections = [];
let activeConnections = new Map();
let connectedClients = new Set();

// WebSocket Server
const wsServer = new WebSocket.Server({ 
  port: WS_PORT,
  host: '0.0.0.0'
});

wsServer.on('connection', (ws) => {
  console.log('WebSocket client connected');
  connectedClients.add(ws);
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    connectedClients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection_status',
    data: { status: 'connected', timestamp: new Date().toISOString() }
  }));
});

// Broadcast function
function broadcast(message) {
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// API Routes - Mit /unicon/api Prefix
const apiRouter = express.Router();

// Get all connections
apiRouter.get('/connections', (req, res) => {
  try {
    console.log('GET /connections - returning', connections.length, 'connections');
    res.json({ success: true, connections });
  } catch (error) {
    console.error('Error getting connections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new connection
apiRouter.post('/connections', (req, res) => {
  try {
    const connection = {
      id: uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString(),
      status: 'disconnected'
    };
    
    connections.push(connection);
    console.log('Created connection:', connection.name, 'ID:', connection.id);
    
    broadcast({
      type: 'log',
      data: { message: `Connection "${connection.name}" erstellt`, type: 'success' }
    });
    
    res.json({ success: true, connection });
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete connection
apiRouter.delete('/connections/:id', (req, res) => {
  try {
    const connectionId = req.params.id;
    
    // Remove from active connections if exists
    if (activeConnections.has(connectionId)) {
      activeConnections.delete(connectionId);
    }
    
    // Remove from connections array
    const initialLength = connections.length;
    connections = connections.filter(conn => conn.id !== connectionId);
    
    if (connections.length < initialLength) {
      console.log('Deleted connection:', connectionId);
      broadcast({
        type: 'log',
        data: { message: 'Connection gelöscht', type: 'info' }
      });
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Connection not found' });
    }
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connect to a protocol
apiRouter.post('/connect', (req, res) => {
  try {
    const { connectionId } = req.body;
    const connection = connections.find(c => c.id === connectionId);
    
    if (!connection) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }
    
    // Simulate connection success for now
    connection.status = 'connected';
    activeConnections.set(connectionId, { status: 'connected' });
    
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
    console.error('Error connecting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect from a protocol
apiRouter.post('/disconnect', (req, res) => {
  try {
    const { connectionId } = req.body;
    const connection = connections.find(c => c.id === connectionId);
    
    if (!connection) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }
    
    connection.status = 'disconnected';
    activeConnections.delete(connectionId);
    
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
    console.error('Error disconnecting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
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

// Mount API router with prefix
app.use('/unicon/api', apiRouter);

// Serve static files for production
app.use('/unicon', express.static(path.join(__dirname, 'public')));

// Fallback for SPA
app.get('/unicon/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Universal Protocol Test Client Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Start servers
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HTTP Server running on port ${PORT}`);
  console.log(`📡 WebSocket Server running on port ${WS_PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}/unicon/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  wsServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  wsServer.close();
  process.exit(0);
});