// server/handlers/ws_handler.js
const WebSocket = require('ws');

class WSHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config || {};
    this.client = null; // WebSocket client to remote endpoint
    this.isConnected = false;
  }

  async connect() {
    const url = this.config.url;
    if (!url) throw new Error('WebSocket URL missing in config');
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, this.config.protocol || undefined);
      this.client = ws;

      ws.on('open', () => {
        this.isConnected = true;
        this._broadcast({ type: 'ws', data: { event: 'connected', connectionId: this.connectionId } });
        resolve({ success: true });
      });
      ws.on('message', (data) => {
        this._broadcast({ type: 'ws', data: { event: 'message', connectionId: this.connectionId, data: data.toString() } });
      });
      ws.on('close', (code, reason) => {
        this.isConnected = false;
        this._broadcast({ type: 'ws', data: { event: 'closed', connectionId: this.connectionId, code, reason: reason?.toString() } });
      });
      ws.on('error', (err) => {
        if (!this.isConnected) reject(new Error(`WS connect error: ${err.message}`));
        this._broadcast({ type: 'ws', data: { event: 'error', connectionId: this.connectionId, error: err.message } });
      });
    });
  }

  async disconnect() {
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.close();
    }
    this.isConnected = false;
    return { success: true };
  }

  async send(message) {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) throw new Error('WS not connected');
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    // Pre-broadcast
    this._broadcast({ type: 'ws', data: { event: 'message', connectionId: this.connectionId, data: payload, stage: 'pre' } });
    this.client.send(payload);
    // Immediate loopback
    this._broadcast({ type: 'ws', data: { event: 'message', connectionId: this.connectionId, data: payload, stage: 'post' } });
    // Delayed rebroadcasts
    setTimeout(() => {
      this._broadcast({ type: 'ws', data: { event: 'message', connectionId: this.connectionId, data: payload, stage: 'delay1' } });
    }, 75);
    setTimeout(() => {
      this._broadcast({ type: 'ws', data: { event: 'message', connectionId: this.connectionId, data: payload, stage: 'delay2' } });
    }, 175);
    return { success: true };
  }

  _broadcast(message) {
    if (global.broadcast) global.broadcast(message);
  }
}

module.exports = WSHandler;
