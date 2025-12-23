// server/handlers/cpd_handler.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class CpdHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId;
    this.config = config;
    this.client = null; // gRPC client
    this.subscriptions = new Map(); // id -> stream
  }

  async connect() {
    const address = this.config.address;
    if (!address) {
      return { success: true, message: 'CPD address missing; handler ready for later init' };
    }
    const defs = await this._loadProto(path.join('cpd.proto'));
    const svc = defs.core.cpd_adapter.cpd;
    const creds = this.config.useTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
    this.client = new svc(address, creds);
    return { success: true };
  }

  async disconnect() {
    // cancel running streams
    for (const [id, stream] of this.subscriptions.entries()) {
      try { stream.cancel(); } catch (_) {}
    }
    this.subscriptions.clear();
    if (this.client && this.client.close) this.client.close();
    this.client = null;
    return { success: true };
  }

  // --- Basic ops ---
  async ping(message = 'ping') {
    this._assertClient();
    return new Promise((resolve, reject) => {
      this.client.ping({ msg: message }, (err, resp) => {
        if (err) return reject(err);
        resolve({ success: true, data: resp });
      });
    });
  }

  async browseTopics({ topicPattern = 'sw.*', limit = 100, beginTopicName = '', reverse = false } = {}) {
    this._assertClient();
    return new Promise((resolve, reject) => {
      this.client.browseTopicNames({ topicPattern, limit, beginTopicName, reverse }, (err, resp) => {
        if (err) return reject(err);
        resolve({ success: true, topicNames: resp?.topicNames || [] });
      });
    });
  }

  async getLatestData({ topicPatterns = null, filterDef = null } = {}) {
    this._assertClient();
    if (Array.isArray(topicPatterns)) {
      return new Promise((resolve, reject) => {
        this.client.simpleGetLatestData({ topicpattern: topicPatterns }, (err, resp) => {
          if (err) return reject(err);
          resolve({ success: true, data: resp?.topicData || [] });
        });
      });
    }
    return new Promise((resolve, reject) => {
      this.client.getLatestData({ filterDef: filterDef || {} }, (err, resp) => {
        if (err) return reject(err);
        resolve({ success: true, data: resp?.topicData || [] });
      });
    });
  }

  // --- Subscriptions ---
  async simpleSubscribe({ id, topicPatterns }) {
    this._assertClient();
    if (!id || !Array.isArray(topicPatterns) || topicPatterns.length === 0) {
      throw new Error('simpleSubscribe requires id and topicPatterns');
    }
    const stream = this.client.simpleSubscribe({ id, topicpattern: topicPatterns });
    this._wireStream(id, stream);
    this.subscriptions.set(id, stream);
    return { success: true };
  }

  async subscribe({ id, filterDef = {}, subsConfig = {} }) {
    this._assertClient();
    if (!id) throw new Error('subscribe requires id');
    const stream = this.client.subscribe({ id, filterDef, subsConfig });
    this._wireStream(id, stream);
    this.subscriptions.set(id, stream);
    return { success: true };
  }

  async unsubscribe({ id }) {
    this._assertClient();
    if (!id) throw new Error('unsubscribe requires id');
    try {
      await new Promise((resolve, reject) => {
        this.client.unsubscribe({ id }, (err) => (err ? reject(err) : resolve()));
      });
    } finally {
      const stream = this.subscriptions.get(id);
      if (stream) {
        try { stream.cancel(); } catch (_) {}
        this.subscriptions.delete(id);
      }
    }
    return { success: true };
  }

  // --- Publish variants ---
  async publishLike(method, topic, data) {
    this._assertClient();
    if (!topic) throw new Error('topic required');
    const payload = { topic, data: typeof data === 'string' ? data : JSON.stringify(data) };
    return new Promise((resolve, reject) => {
      this.client[method](payload, (err) => (err ? reject(err) : resolve({ success: true })));
    });
  }

  publish({ topic, data }) { return this.publishLike('publish', topic, data); }
  publishUpdate({ topic, data }) { return this.publishLike('publishUpdate', topic, data); }
  deltaPublish({ topic, data }) { return this.publishLike('deltaPublish', topic, data); }
  publishDeltaToDelta({ topic, data }) { return this.publishLike('publishDeltaToDelta', topic, data); }
  publishDeltaToFull({ topic, data }) { return this.publishLike('publishDeltaToFull', topic, data); }
  publishFullToDelta({ topic, data }) { return this.publishLike('publishFullToDelta', topic, data); }
  sendTopic({ topic, data }) { return this.publishLike('sendTopic', topic, data); }

  // --- Internals ---
  _wireStream(id, stream) {
    stream.on('data', (msg) => {
      const topics = (msg?.topicData || []).map(td => ({ topic: td.topic, data: td.data }));
      this._broadcast({
        type: 'data',
        data: { payload: { type: 'topicChange', subscriptionId: id, topics } }
      });
    });
    stream.on('error', (err) => {
      this._broadcast({ type: 'log', data: { message: `CPD stream ${id} error: ${err.message}`, type: 'error' } });
      this.subscriptions.delete(id);
    });
    stream.on('end', () => {
      this._broadcast({ type: 'log', data: { message: `CPD stream ${id} ended`, type: 'info' } });
      this.subscriptions.delete(id);
    });
  }

  _broadcast(message) {
    if (global.broadcast) global.broadcast(message);
  }

  _assertClient() {
    if (!this.client) throw new Error('CPD client not initialized (connect first)');
  }

  async _loadProto(protoRelPath) {
    const fullPath = path.isAbsolute(protoRelPath)
      ? protoRelPath
      : path.join(__dirname, '..', 'proto', protoRelPath);
    const packageDefinition = await protoLoader.load(fullPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    return grpc.loadPackageDefinition(packageDefinition);
  }
}

module.exports = CpdHandler;