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

class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.loadConnections();
  }

  loadConnections() {
    try {
      const connections = connDb.get('connections').value();
      connections.forEach(conn => {
        this.connections.set(conn.id, conn);
      });
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  }

  saveConnections() {
    try {
      const connections = Array.from(this.connections.values());
      connDb.set('connections', connections).write();
    } catch (error) {
      console.error('Error saving connections:', error);
    }
  }

  add(connection) {
    connection.id = connection.id || uuidv4();
    connection.createdAt = connection.createdAt || new Date().toISOString();
    this.connections.set(connection.id, connection);
    this.saveConnections();
    return connection;
  }

  get(id) {
    return this.connections.get(id);
  }

  getAll() {
    return Array.from(this.connections.values());
  }

  delete(id) {
    const deleted = this.connections.delete(id);
    if (deleted) {
      this.saveConnections();
    }
    return deleted;
  }

  update(id, updates) {
    const connection = this.connections.get(id);
    if (connection) {
      Object.assign(connection, updates);
      this.saveConnections();
    }
    return connection;
  }
}

const connectionManager = new ConnectionManager();

// WebSocket Server Setup
const setupWebSocketServer = () => {
  wsServer = new WebSocket.Server({ port: WS_PORT });
  
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
  });
  
  console.log(`WebSocket server running on port ${WS_PORT}`);
};

// Broadcast to all connected WebSocket clients
const broadcast = (message) => {
  const messageString = JSON.stringify(message);
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageString);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        connectedClients.delete(client);
      }
    }
  });
};

// Utility function to create log message
const createLogMessage = (message, type = 'info') => {
  return {
    type: 'log',
    data: {
      message,
      type,
      timestamp: new Date().toISOString()
    }
  };
};

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
          initialDelay: 1000,
          maxRetry: 1
        },
        securityMode: MessageSecurityMode[this.config.securityMode] || MessageSecurityMode.None,
        securityPolicy: SecurityPolicy[this.config.securityPolicy] || SecurityPolicy.None,
        endpointMustExist: false
      });

      await this.client.connect(this.config.endpoint);
      this.session = await this.client.createSession();
      
      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'connected' }
      });

      return { success: true };
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect() {
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

      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'disconnected' }
      });

      return { success: true };
    } catch (error) {
      console.error('OPC UA disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  async browse(nodeId = 'RootFolder') {
    if (!this.session) throw new Error('Not connected');
    
    const browseResult = await this.session.browse(nodeId);
    const nodes = [];

    for (const reference of browseResult.references) {
      try {
        const nodesToRead = [
          { nodeId: reference.nodeId, attributeId: AttributeIds.DisplayName },
          { nodeId: reference.nodeId, attributeId: AttributeIds.DataType },
          { nodeId: reference.nodeId, attributeId: AttributeIds.Value },
          { nodeId: reference.nodeId, attributeId: AttributeIds.AccessLevel }
        ];

        const dataValues = await this.session.read(nodesToRead);
        
        nodes.push({
          nodeId: reference.nodeId.toString(),
          browseName: reference.browseName.toString(),
          displayName: dataValues[0].statusCode.name === 'Good' ? 
            dataValues[0].value.value.text : reference.browseName.toString(),
          dataType: dataValues[1].statusCode.name === 'Good' ? 
            dataValues[1].value?.value?.toString() || 'Unknown' : 'Unknown',
          value: dataValues[2].statusCode.name === 'Good' ? 
            dataValues[2].value?.value?.toString() || null : null,
          accessLevel: this.getAccessLevelString(dataValues[3].value?.value || 0),
          hasChildren: reference.isForward
        });
      } catch (nodeError) {
        console.warn(`Error reading node ${reference.nodeId}:`, nodeError.message);
      }
    }

    return { success: true, nodes };
  }

  async read(nodeId) {
    if (!this.session) throw new Error('Not connected');
    
    const dataValue = await this.session.readVariableValue(nodeId);
    return {
      success: true,
      data: {
        nodeId,
        value: dataValue.value.value,
        dataType: dataValue.value.dataType.toString(),
        sourceTimestamp: dataValue.sourceTimestamp,
        statusCode: dataValue.statusCode.name
      }
    };
  }

  async write(nodeId, value, dataType) {
    if (!this.session) throw new Error('Not connected');
    
    const nodesToWrite = [{
      nodeId: nodeId,
      attributeId: AttributeIds.Value,
      value: {
        value: {
          dataType: this.getDataTypeFromString(dataType),
          value: this.convertValueByDataType(value, dataType)
        }
      }
    }];

    const statusCodes = await this.session.write(nodesToWrite);
    return {
      success: statusCodes[0].name === 'Good',
      statusCode: statusCodes[0].name
    };
  }

  getAccessLevelString(accessLevel) {
    const levels = [];
    if (accessLevel & 0x01) levels.push('Read');
    if (accessLevel & 0x02) levels.push('Write');
    return levels.length > 0 ? levels.join('') : 'None';
  }

  convertValueByDataType(value, dataType) {
    switch (dataType?.toLowerCase()) {
      case 'boolean':
        return value === 'true' || value === true || value === 1 || value === '1';
      case 'int32':
      case 'uint32':
      case 'int16':
      case 'uint16':
        return parseInt(value, 10);
      case 'double':
      case 'float':
        return parseFloat(value);
      default:
        return value.toString();
    }
  }

  getDataTypeFromString(dataType) {
    const { DataType } = require('node-opcua');
    
    switch (dataType?.toLowerCase()) {
      case 'boolean': return DataType.Boolean;
      case 'int32': return DataType.Int32;
      case 'uint32': return DataType.UInt32;
      case 'double': return DataType.Double;
      case 'float': return DataType.Float;
      case 'string': return DataType.String;
      default: return DataType.Variant;
    }
  }
}

class RestHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Test connection with a simple request
      const headers = this.buildHeaders();
      await axios.get(this.config.baseUrl, { 
        headers, 
        timeout: 5000,
        validateStatus: () => true // Accept any status for connection test
      });
      
      this.isConnected = true;
      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'connected' }
      });
      
      return { success: true };
    } catch (error) {
      this.isConnected = false;
      throw new Error(`REST connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    this.isConnected = false;
    broadcast({
      type: 'connection_status',
      data: { connectionId: this.connectionId, status: 'disconnected' }
    });
    return { success: true };
  }

  async request(method, endpoint, data = null, headers = {}) {
    if (!this.isConnected) throw new Error('Not connected');
    
    const requestHeaders = { ...this.buildHeaders(), ...headers };
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const config = {
      method,
      url,
      headers: requestHeaders,
      timeout: 10000
    };
    
    if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.data = data;
    }
    
    const response = await axios(config);
    return {
      success: true,
      data: {
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
        
        this.ws.onopen = () => {
          broadcast({
            type: 'connection_status',
            data: { connectionId: this.connectionId, status: 'connected' }
          });
          
          // Setup heartbeat if configured
          if (this.config.heartbeat && this.config.heartbeat > 0) {
            this.heartbeatInterval = setInterval(() => {
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
              }
            }, parseInt(this.config.heartbeat));
          }
          
          resolve({ success: true });
        };
        
        this.ws.onclose = () => {
          this.cleanup();
          broadcast({
            type: 'connection_status',
            data: { connectionId: this.connectionId, status: 'disconnected' }
          });
        };
        
        this.ws.onerror = (error) => {
          this.cleanup();
          reject(new Error(`WebSocket connection failed: ${error.message}`));
        };
        
        this.ws.onmessage = (event) => {
          broadcast({
            type: 'data',
            data: {
              connectionId: this.connectionId,
              payload: {
                type: 'message',
                data: event.data,
                timestamp: new Date().toISOString()
              }
            }
          });
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    return { success: true };
  }

  async send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    this.ws.send(message);
    return { success: true };
  }

  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

class GrpcHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config;
    this.client = null;
    this.proto = null;
    this.services = new Map();
  }

  async connect() {
    try {
      const grpc = require('@grpc/grpc-js');
      const protoLoader = require('@grpc/proto-loader');
      
      // Load proto file
      if (this.config.protoFile) {
        const packageDefinition = protoLoader.loadSync(this.config.protoFile, {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true
        });
        
        this.proto = grpc.loadPackageDefinition(packageDefinition);
        
        // Create client for the specified service
        if (this.config.service && this.proto[this.config.service]) {
          const credentials = this.config.useTls ? 
            grpc.credentials.createSsl() : 
            grpc.credentials.createInsecure();
            
          this.client = new this.proto[this.config.service](
            this.config.address,
            credentials
          );
          
          this.services.set(this.config.service, this.client);
        }
      }
      
      // Test connection with a simple health check
      if (this.client && this.client.healthCheck) {
        await new Promise((resolve, reject) => {
          this.client.healthCheck({}, (error, response) => {
            if (error) reject(error);
            else resolve(response);
          });
        });
      }
      
      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'connected' }
      });
      
      return { success: true };
    } catch (error) {
      throw new Error(`gRPC connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        this.client.close();
        this.client = null;
      }
      
      this.services.clear();
      this.proto = null;
      
      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'disconnected' }
      });
      
      return { success: true };
    } catch (error) {
      console.error('gRPC disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  async call(service, method, request, metadata = {}) {
    if (!this.client) throw new Error('Not connected');
    
    const serviceClient = this.services.get(service) || this.client;
    if (!serviceClient[method]) {
      throw new Error(`Method ${method} not found in service ${service}`);
    }
    
    return new Promise((resolve, reject) => {
      const grpcMetadata = new (require('@grpc/grpc-js').Metadata)();
      Object.entries(metadata).forEach(([key, value]) => {
        grpcMetadata.add(key, value);
      });
      
      serviceClient[method](request, grpcMetadata, (error, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getServices() {
    if (!this.proto) return [];
    
    const services = [];
    Object.keys(this.proto).forEach(key => {
      if (typeof this.proto[key] === 'function') {
        services.push({
          name: key,
          methods: this.getServiceMethods(this.proto[key])
        });
      }
    });
    
    return services;
  }

  getServiceMethods(serviceConstructor) {
    const methods = [];
    if (serviceConstructor.prototype) {
      Object.getOwnPropertyNames(serviceConstructor.prototype).forEach(methodName => {
        if (methodName !== 'constructor') {
          methods.push({
            name: methodName,
            type: 'unary' // This would need more sophisticated detection
          });
        }
      });
    }
    return methods;
  }
}

// CPD Handler Class
class CpdHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config;
    this.client = null;
    this.wsClient = null;
    this.subscriptions = new Map();
    this.proto = null;
    this.isGrpc = config.protocol === 'grpc';
  }

  async connect() {
    try {
      if (this.isGrpc) {
        await this.connectGrpc();
      } else {
        await this.connectWebSocket();
      }
      
      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'connected' }
      });
      
      return { success: true };
    } catch (error) {
      throw new Error(`CPD connection failed: ${error.message}`);
    }
  }

  async connectGrpc() {
    const grpc = require('@grpc/grpc-js');
    const protoLoader = require('@grpc/proto-loader');
    
    // Load CPD proto file
    const packageDefinition = protoLoader.loadSync(__dirname + '/proto/cpd.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    
    this.proto = grpc.loadPackageDefinition(packageDefinition).core.cpd_adapter;
    
    const credentials = this.config.useTls ? 
      grpc.credentials.createSsl() : 
      grpc.credentials.createInsecure();
      
    this.client = new this.proto.cpd(this.config.address, credentials);
    
    // Test connection with ping
    await new Promise((resolve, reject) => {
      this.client.ping({ msg: 'test' }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async connectWebSocket() {
    const WebSocket = require('ws');
    
    this.wsClient = new WebSocket(this.config.url);
    
    return new Promise((resolve, reject) => {
      this.wsClient.on('open', () => {
        console.log('[CPD WebSocket] Connected');
        resolve();
      });
      
      this.wsClient.on('error', (error) => {
        reject(error);
      });
      
      this.wsClient.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('[CPD WebSocket] Parse error:', error);
        }
      });
      
      this.wsClient.on('close', () => {
        broadcast({
          type: 'connection_status',
          data: { connectionId: this.connectionId, status: 'disconnected' }
        });
      });
    });
  }

  async disconnect() {
    try {
      // Unsubscribe all active subscriptions
      for (const [id, subscription] of this.subscriptions) {
        await this.unsubscribe(id);
      }
      
      if (this.client) {
        this.client.close();
        this.client = null;
      }
      
      if (this.wsClient) {
        this.wsClient.close();
        this.wsClient = null;
      }
      
      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'disconnected' }
      });
      
      return { success: true };
    } catch (error) {
      console.error('CPD disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  async ping(message = 'ping') {
    if (this.isGrpc && this.client) {
      return new Promise((resolve, reject) => {
        this.client.ping({ msg: message }, (error, response) => {
          if (error) reject(error);
          else resolve(response);
        });
      });
    } else if (this.wsClient) {
      // WebSocket ping implementation
      const pingData = JSON.stringify({ type: 'ping', msg: message });
      this.wsClient.send(pingData);
      return { msg: `Ping sent: ${message}` };
    }
    throw new Error('Not connected');
  }

  async subscribe(id, topicPatterns, config = {}) {
    if (this.isGrpc && this.client) {
      return new Promise((resolve, reject) => {
        const request = {
          id: id,
          filterDef: {
            mode: 0, // DEFAULT
            caseSensitive: false,
            topicpattern: topicPatterns
          },
          subsConfig: {
            storeAll: config.storeAll || false,
            flatSubscribe: config.flatSubscribe || true,
            sendInitialData: config.sendInitialData || true,
            aggrMode: config.aggrMode || 0
          }
        };
        
        const stream = this.client.subscribe(request);
        
        stream.on('data', (topicChange) => {
          this.handleTopicChange(topicChange);
        });
        
        stream.on('error', (error) => {
          console.error('[CPD gRPC] Subscription error:', error);
          reject(error);
        });
        
        stream.on('end', () => {
          console.log('[CPD gRPC] Subscription ended');
          this.subscriptions.delete(id);
        });
        
        this.subscriptions.set(id, { stream, topicPatterns, config });
        resolve({ success: true, subscriptionId: id });
      });
    } else if (this.wsClient) {
      // WebSocket subscription
      const subscribeData = JSON.stringify({
        type: 'subscribe',
        id: id,
        topics: topicPatterns,
        config: config
      });
      
      this.wsClient.send(subscribeData);
      this.subscriptions.set(id, { topicPatterns, config });
      return { success: true, subscriptionId: id };
    }
    throw new Error('Not connected');
  }

  async simpleSubscribe(id, topicPatterns) {
    if (this.isGrpc && this.client) {
      return new Promise((resolve, reject) => {
        const request = {
          id: id,
          topicpattern: topicPatterns
        };
        
        const stream = this.client.simpleSubscribe(request);
        
        stream.on('data', (topicChange) => {
          this.handleTopicChange(topicChange);
        });
        
        stream.on('error', (error) => {
          reject(error);
        });
        
        this.subscriptions.set(id, { stream, topicPatterns });
        resolve({ success: true, subscriptionId: id });
      });
    }
    // Fallback to regular subscribe for WebSocket
    return this.subscribe(id, topicPatterns);
  }

  async unsubscribe(id) {
    if (this.isGrpc && this.client) {
      const subscription = this.subscriptions.get(id);
      if (subscription && subscription.stream) {
        subscription.stream.cancel();
      }
      
      return new Promise((resolve, reject) => {
        this.client.unsubscribe({ id: id }, (error, response) => {
          if (error) {
            reject(error);
          } else {
            this.subscriptions.delete(id);
            resolve({ success: true });
          }
        });
      });
    } else if (this.wsClient) {
      const unsubscribeData = JSON.stringify({
        type: 'unsubscribe',
        id: id
      });
      
      this.wsClient.send(unsubscribeData);
      this.subscriptions.delete(id);
      return { success: true };
    }
    throw new Error('Not connected');
  }

  async publish(topic, data, mode = 'publish') {
    const topicData = {
      topic: topic,
      data: typeof data === 'string' ? data : JSON.stringify(data)
    };
    
    if (this.isGrpc && this.client) {
      return new Promise((resolve, reject) => {
        const method = this.client[mode] || this.client.publish;
        method.call(this.client, topicData, (error, response) => {
          if (error) reject(error);
          else resolve({ success: true });
        });
      });
    } else if (this.wsClient) {
      const publishData = JSON.stringify({
        type: mode,
        topic: topic,
        data: data
      });
      
      this.wsClient.send(publishData);
      return { success: true };
    }
    throw new Error('Not connected');
  }

  async getLatestData(topicPatterns) {
    if (this.isGrpc && this.client) {
      return new Promise((resolve, reject) => {
        const request = { topicpattern: topicPatterns };
        
        this.client.simpleGetLatestData(request, (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              success: true,
              data: response.topicData || []
            });
          }
        });
      });
    } else if (this.wsClient) {
      // WebSocket implementation for getting latest data
      const requestData = JSON.stringify({
        type: 'getLatestData',
        topics: topicPatterns
      });
      
      this.wsClient.send(requestData);
      return { success: true, message: 'Request sent' };
    }
    throw new Error('Not connected');
  }

  async browseTopics(topicPattern, limit = 100, beginTopicName = '', reverse = false) {
    if (this.isGrpc && this.client) {
      return new Promise((resolve, reject) => {
        const request = {
          topicPattern: topicPattern,
          limit: limit,
          beginTopicName: beginTopicName,
          reverse: reverse
        };
        
        this.client.browseTopicNames(request, (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              success: true,
              topicNames: response.topicNames || []
            });
          }
        });
      });
    } else if (this.wsClient) {
      const browseData = JSON.stringify({
        type: 'browseTopics',
        pattern: topicPattern,
        limit: limit,
        begin: beginTopicName,
        reverse: reverse
      });
      
      this.wsClient.send(browseData);
      return { success: true, message: 'Browse request sent' };
    }
    throw new Error('Not connected');
  }

  handleMessage(message) {
    // Handle WebSocket messages
    if (message.topic && message.data) {
      this.handleTopicChange({
        id: message.id || 0,
        topicData: [{ topic: message.topic, data: message.data }]
      });
    }
  }

  handleTopicChange(topicChange) {
    // Broadcast topic changes to WebSocket clients
    broadcast({
      type: 'data',
      data: {
        connectionId: this.connectionId,
        payload: {
          type: 'topicChange',
          subscriptionId: topicChange.id,
          topics: topicChange.topicData || []
        }
      }
    });
  }

  mqttMatch(filter, topic) {
    // MQTT-style topic matching (from provided mqtt-match.js)
    const filterArray = filter.split('.');
    const length = filterArray.length;
    const topicArray = topic.split('.');

    for (let i = 0; i < length; ++i) {
      const left = filterArray[i];
      const right = topicArray[i];
      if (left === '#') return topicArray.length >= length - 1;
      if (left !== '*' && left !== right) return false;
    }

    return length === topicArray.length;
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
      switch (this.config.type) {
        case 'PostgreSQL':
          this.connection = new Client({
            host: this.config.host,
            port: this.config.port || 5432,
            database: this.config.database,
            user: this.config.username,
            password: this.config.password
          });
          await this.connection.connect();
          break;
          
        case 'MySQL':
          this.connection = await mysql.createConnection({
            host: this.config.host,
            port: this.config.port || 3306,
            database: this.config.database,
            user: this.config.username,
            password: this.config.password
          });
          break;
          
        case 'SQLite':
          this.connection = new sqlite3.Database(this.config.database);
          break;
          
        default:
          throw new Error(`Unsupported database type: ${this.config.type}`);
      }
      
      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'connected' }
      });
      
      return { success: true };
    } catch (error) {
      throw new Error(`SQL connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        switch (this.config.type) {
          case 'PostgreSQL':
            await this.connection.end();
            break;
          case 'MySQL':
            await this.connection.end();
            break;
          case 'SQLite':
            this.connection.close();
            break;
        }
        this.connection = null;
      }
      
      broadcast({
        type: 'connection_status',
        data: { connectionId: this.connectionId, status: 'disconnected' }
      });
      
      return { success: true };
    } catch (error) {
      console.error('SQL disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  async query(sql, params = []) {
    if (!this.connection) throw new Error('Not connected');
    
    try {
      let result;
      
      switch (this.config.type) {
        case 'PostgreSQL':
          result = await this.connection.query(sql, params);
          return { success: true, data: result.rows, rowCount: result.rowCount };
          
        case 'MySQL':
          const [rows, fields] = await this.connection.execute(sql, params);
          return { success: true, data: rows, fields: fields.map(f => f.name) };
          
        case 'SQLite':
          return new Promise((resolve, reject) => {
            this.connection.all(sql, params, (err, rows) => {
              if (err) reject(err);
              else resolve({ success: true, data: rows });
            });
          });
          
        default:
          throw new Error(`Unsupported database type: ${this.config.type}`);
      }
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  async getSchema() {
    if (!this.connection) throw new Error('Not connected');
    
    try {
      let schemaQuery;
      
      switch (this.config.type) {
        case 'PostgreSQL':
          schemaQuery = `
            SELECT 
              table_name,
              column_name,
              data_type,
              is_nullable,
              column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            ORDER BY table_name, ordinal_position
          `;
          break;
          
        case 'MySQL':
          schemaQuery = `
            SELECT 
              table_name,
              column_name,
              data_type,
              is_nullable,
              column_default
            FROM information_schema.columns 
            WHERE table_schema = DATABASE()
            ORDER BY table_name, ordinal_position
          `;
          break;
          
        case 'SQLite':
          // SQLite requires a different approach
          const tablesResult = await new Promise((resolve, reject) => {
            this.connection.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });
          
          const schema = [];
          for (const table of tablesResult) {
            const columnsResult = await new Promise((resolve, reject) => {
              this.connection.all(`PRAGMA table_info(${table.name})`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              });
            });
            
            schema.push(...columnsResult.map(col => ({
              table_name: table.name,
              column_name: col.name,
              data_type: col.type,
              is_nullable: col.notnull ? 'NO' : 'YES',
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

// API Routes

// Get all connections
app.get('/api/connections', (req, res) => {
  try {
    const connections = connectionManager.getAll();
    res.json({ success: true, connections });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new connection
app.post('/api/connections', (req, res) => {
  try {
    const connection = connectionManager.add(req.body);
    broadcast(createLogMessage(`Connection "${connection.name}" erstellt`, 'success'));
    res.json({ success: true, connection });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update connection
app.put('/api/connections/:id', (req, res) => {
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
app.delete('/api/connections/:id', (req, res) => {
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
app.post('/api/connect', async (req, res) => {
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
app.post('/api/disconnect', async (req, res) => {
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
app.post('/api/operation', async (req, res) => {
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
app.get('/api/status/:connectionId', (req, res) => {
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