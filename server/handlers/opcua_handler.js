// server/handlers/opcua_handler.js
const { OPCUAClient, AttributeIds, MessageSecurityMode, SecurityPolicy, Variant, VariantArrayType, DataType } = require('node-opcua');

class OPCUAHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId;
    this.config = config;
    this.client = null;
    this.session = null;
    this.isConnected = false;
    // Cache of node metadata: { dataType, valueRank, arrayDimensions }
    this._metaCache = new Map();
    // monitor sessions by id -> { subscription, items: MonitoredItem[], logPath }
    this._monitors = new Map();
  }

  async connect() {
    // Normalize and validate endpoint URL early to avoid opaque NaN port errors from node-opcua
    const raw = (this.config.endpointUrl || this.config.endpoint || '').trim();
    if (!raw) throw new Error('OPC UA endpointUrl is required');
    const m = raw.match(/^opc\.tcp:\/\/([^:\/]+):(\d{1,5})(\/.*)?$/i);
    if (!m) {
      throw new Error('Invalid OPC UA endpointUrl. Expected format: opc.tcp://host:port');
    }
    const host = m[1];
    const port = Number(m[2]);
    const path = m[3] || '';
    if (!Number.isFinite(port) || port < 0 || port >= 65536) {
      throw new Error('Invalid OPC UA port: must be 0-65535');
    }
    const endpointUrl = `opc.tcp://${host}:${port}${path}`;

    const modeMap = { None: MessageSecurityMode.None, Sign: MessageSecurityMode.Sign, SignAndEncrypt: MessageSecurityMode.SignAndEncrypt };
    const polMap = {
      None: SecurityPolicy.None,
      Basic128Rsa15: SecurityPolicy.Basic128Rsa15,
      Basic256: SecurityPolicy.Basic256,
      Basic256Sha256: SecurityPolicy.Basic256Sha256,
      Aes128_Sha256_RsaOaep: SecurityPolicy.Aes128_Sha256_RsaOaep,
      Aes256_Sha256_RsaPss: SecurityPolicy.Aes256_Sha256_RsaPss,
    };
    // If username/password is provided, security mode must not be None
    const ui = this.config.userIdentity || {};
    const userName = (ui.userName ?? ui.username ?? this.config.username) || undefined;
    const password = (ui.password ?? this.config.password) || undefined;
    if (userName && (this.config.securityMode === 'None' || this.config.securityPolicy === 'None')) {
      throw new Error('Username/password requires Security Mode Sign or SignAndEncrypt with a non-None policy');
    }

    const client = OPCUAClient.create({
      applicationName: 'Universal Test Client',
      securityMode: modeMap[this.config.securityMode] ?? MessageSecurityMode.None,
      securityPolicy: polMap[this.config.securityPolicy] ?? SecurityPolicy.None,
      endpointMustExist: false,
      keepSessionAlive: true,
      connectionStrategy: { initialDelay: 250, maxRetry: 1 }
    });

    const timeoutMs = Number(this.config.timeoutMs || 10000);
    const connectPromise = client.connect(endpointUrl);
    const timed = new Promise((_, reject) => setTimeout(() => reject(new Error('OPC UA connect timeout')), timeoutMs));
    await Promise.race([connectPromise, timed]);

    // Prefer simple username/password form (avoids token-type issues across node-opcua versions)
    const session = userName ? await client.createSession({ userName, password })
                             : await client.createSession();

    this.client = client;
    this.session = session;
    this.isConnected = true;

    return { success: true };
  }

  async disconnect() {
    try {
      for (const [id] of this._monitors) { try { await this.monitorStop(id); } catch(_){} }
    } catch {}
    try { if (this.session) await this.session.close(); } catch {}
    try { if (this.client) await this.client.disconnect(); } catch {}
    this.client = null;
    this.session = null;
    this.isConnected = false;
    this._metaCache.clear();
    return { success: true };
  }

  async browse(nodeId = 'RootFolder') {
    if (!this.session) throw new Error('Not connected');
    const result = await this.session.browse(nodeId);
    return { success: true, data: result.references || [] };
  }

  async read(nodes) {
    if (!this.session) throw new Error('Not connected');
    const nodesToRead = (Array.isArray(nodes) ? nodes : [nodes]).map((n) => ({ nodeId: n, attributeId: AttributeIds.Value }));
    const dataValues = await this.session.read(nodesToRead);
    return { success: true, data: dataValues };
  }

  async write(nodeId, value, dataType = null) {
    if (!this.session) throw new Error('Not connected');
    if (!nodeId) throw new Error('nodeId is required');

    // Fetch and cache node meta (datatype, valueRank, arrayDimensions)
    const meta = await this._getNodeMeta(nodeId);

    // Choose dataType: explicit > meta-inferred > heuristic
    let dt = dataType ?? meta?.dataType;

    // Validate rank/shape before coercion/write
    const rankCheck = this._validateRankAndShape(value, meta);
    if (!rankCheck.ok) {
      return { success: false, error: rankCheck.error };
    }

    const variant = this._coerceVariant(value, dt);
    const statusCode = await this.session.writeSingleNode(nodeId, variant);
    const scStr = statusCode?.name || String(statusCode || '');
    let ok = !!statusCode && (statusCode.value === 0 || scStr.includes('Good'));

    // Fallbacks for arrays (avoid server array encoding quirks)
    if (!ok && Array.isArray(value)) {
      const { DataValue } = require('node-opcua-data-value');
      // 1) Try a full write via write() API
      const full = await this.session.write([{
        nodeId,
        attributeId: AttributeIds.Value,
        value: new DataValue({ value: this._coerceVariant(value, dt) })
      }]);
      if (Array.isArray(full) && full[0] && (full[0].value === 0 || (full[0].name||'').includes('Good'))) {
        return { success: true, statusCode: full[0].name || String(full[0]) };
      }
      // 2) Element-wise indexRange writes
      const writes = value.map((el, i) => ({
        nodeId,
        attributeId: AttributeIds.Value,
        indexRange: `${i}:${i}`,
        value: new DataValue({ value: this._coerceVariant(el, dt) })
      }));
      const results = await this.session.write(writes);
      ok = Array.isArray(results) && results.every(rc => rc && (rc.value === 0 || (rc.name||'').includes('Good')));
      return { success: ok, statusCodes: results.map(r => r?.name || String(r||'')) };
    }

    return { success: ok, statusCode: scStr };
  }

  async monitorStart({ nodeIds = [], options = {} }) {
    if (!this.session) throw new Error('Not connected');
    const ids = Array.isArray(nodeIds) ? nodeIds.filter(Boolean) : [];
    if (!ids.length) throw new Error('nodeIds required');
    const { publishingInterval = 1000, samplingInterval = 1000, queueSize = 10, discardOldest = true, datasetId = 'opcua', logPath } = options || {};
    const { Subscription, TimestampsToReturn, MonitoringMode, ReadValueIdOptions } = require('node-opcua-client');
    const { DataValue } = require('node-opcua-data-value');
    const fs = require('fs');
    const path = require('path');

    const sub = await this.session.createSubscription2({
      requestedPublishingInterval: publishingInterval,
      requestedLifetimeCount: 60,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 100,
      publishingEnabled: true,
      priority: 1
    });

    const monitorId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const baseLog = logPath || path.join(__dirname, '..', 'nodered', 'logs', `${datasetId}-${this.connectionId}.csv`);
    try { fs.mkdirSync(path.dirname(baseLog), { recursive: true }); } catch {}
    fs.existsSync(baseLog) || fs.writeFileSync(baseLog, 'timestamp,nodeId,value,status\n');

    const items = [];
    // Lazy MQTT client (optional)
    let mqttClient = null;
    const mqttUrl = process.env.MQTT_BROKER_URL || process.env.MQTT_URL || '';
    if (mqttUrl) {
      try {
        if (!global.__mqttClient) {
          const mqtt = require('mqtt');
          global.__mqttClient = mqtt.connect(mqttUrl, {
            username: process.env.MQTT_USERNAME || undefined,
            password: process.env.MQTT_PASSWORD || undefined,
            reconnectPeriod: 2000,
          });
        }
        mqttClient = global.__mqttClient;
      } catch(_) { mqttClient = null; }
    }

    for (const nid of ids) {
      const mi = await sub.monitor({ nodeId: nid, attributeId: AttributeIds.Value }, { samplingInterval, discardOldest, queueSize }, TimestampsToReturn.Both);
      mi.on('changed', (dv) => {
        try {
          const ts = new Date().toISOString();
          const val = dv?.value?.value;
          const status = dv?.statusCode?.name || String(dv?.statusCode || '');
          const line = `${ts},${JSON.stringify(nid)},${JSON.stringify(val)},${JSON.stringify(status)}`;
          fs.appendFile(baseLog, line + '\n', ()=>{});
          if (global.broadcast) global.broadcast({ type: 'opcua', data: { event: 'data', connectionId: this.connectionId, nodeId: nid, value: val, status, ts } });
          if (mqttClient && mqttClient.connected) {
            const topic = `opcua/${datasetId}/${encodeURIComponent(String(nid))}`;
            const payload = JSON.stringify({ ts, nodeId: nid, value: val, status, connectionId: this.connectionId });
            try { mqttClient.publish(topic, payload, { qos: 0, retain: false }); } catch(_){}
          }
        } catch(_){ }
      });
      items.push(mi);
    }

    this._monitors.set(monitorId, { subscription: sub, items, logPath: baseLog });
    return { success: true, monitorId, logPath: baseLog };
  }

  async monitorStop(monitorId) {
    const m = this._monitors.get(monitorId);
    if (!m) return { success: true, stopped: false };
    try {
      for (const it of m.items || []) { try { await it.terminate(); } catch(_){} }
      try { await m.subscription.terminate(); } catch(_){}
    } finally {
      this._monitors.delete(monitorId);
    }
    return { success: true, stopped: true };
  }

  async _inferDataTypeForNode(nodeId) {
    const dv = await this.session.read({ nodeId, attributeId: AttributeIds.DataType });
    const dtNodeId = dv?.value?.value;
    if (dtNodeId && dtNodeId.namespace === 0 && typeof dtNodeId.value === 'number') {
      return dtNodeId.value;
    }
    // Fallback: read current value's variant to infer dataType
    const valDV = await this.session.read({ nodeId, attributeId: AttributeIds.Value });
    const vt = valDV?.value?.dataType;
    if (typeof vt === 'number') return vt;
    return undefined;
  }

  async _getNodeMeta(nodeId) {
    if (this._metaCache.has(nodeId)) return this._metaCache.get(nodeId);
    const toRead = [
      { nodeId, attributeId: AttributeIds.DataType },
      { nodeId, attributeId: AttributeIds.ValueRank },
      { nodeId, attributeId: AttributeIds.ArrayDimensions },
    ];
    const [dtDV, rankDV, dimsDV] = await this.session.read(toRead);
    const meta = {
      dataType: (dtDV?.value?.value && dtDV.value.value.namespace === 0) ? dtDV.value.value.value : undefined,
      valueRank: typeof rankDV?.value?.value === 'number' ? rankDV.value.value : -1,
      arrayDimensions: Array.isArray(dimsDV?.value?.value) ? dimsDV.value.value : [],
    };
    this._metaCache.set(nodeId, meta);
    return meta;
  }

  _validateRankAndShape(value, meta) {
    if (!meta) return { ok: true };
    const rank = meta.valueRank;
    if (rank == null || rank === -1) {
      // Scalar expected
      if (Array.isArray(value)) return { ok: false, error: 'BadTypeMismatch: scalar expected' };
      return { ok: true };
    }
    // Array expected (rank >= 1)
    if (!Array.isArray(value)) return { ok: false, error: 'BadTypeMismatch: array expected' };
    // Validate dimension lengths if provided (zeros mean unspecified)
    if (Array.isArray(meta.arrayDimensions) && meta.arrayDimensions.length > 0) {
      const fixedDims = meta.arrayDimensions.every(d => typeof d === 'number' && d > 0);
      if (fixedDims && meta.arrayDimensions.length === 1) {
        if (value.length !== meta.arrayDimensions[0]) {
          return { ok: false, error: `BadTypeMismatch: expected length ${meta.arrayDimensions[0]}` };
        }
      }
      // For multi-dim arrays, validation would need nested shapes; omitted for now.
    }
    return { ok: true };
  }

  _coerceVariant(val, dt) {
    // If val is already a Variant, pass through
    if (val && val.dataType !== undefined && val.value !== undefined) {
      return val;
    }
    const map = {
      Boolean: DataType.Boolean,
      Int16: DataType.Int16,
      Int32: DataType.Int32,
      Int64: DataType.Int64,
      UInt16: DataType.UInt16,
      UInt32: DataType.UInt32,
      UInt64: DataType.UInt64,
      Float: DataType.Float,
      Double: DataType.Double,
      String: DataType.String,
      DateTime: DataType.DateTime,
      ByteString: DataType.ByteString,
    };
    let dataType = undefined;
    if (dt !== undefined && dt !== null) {
      if (typeof dt === 'number') dataType = dt; // already a DataType id
      else if (typeof dt === 'string' && map[dt] !== undefined) dataType = map[dt];
    }

    // Infer when not provided
    if (dataType === undefined) {
      if (Array.isArray(val)) {
        // Infer from first element
        const first = val[0];
        if (typeof first === 'number') dataType = Number.isInteger(first) ? DataType.Int32 : DataType.Double;
        else if (typeof first === 'boolean') dataType = DataType.Boolean;
        else dataType = DataType.String;
        return new Variant({ dataType, arrayType: VariantArrayType.Array, value: val });
      }
      // If string but numeric-like, coerce to number to match common scalar writes
      if (typeof val === 'string') {
        const maybe = Number(val);
        if (Number.isFinite(maybe)) {
          dataType = Number.isInteger(maybe) ? DataType.Int32 : DataType.Double;
          return new Variant({ dataType, value: maybe });
        }
      }
      switch (typeof val) {
        case 'number':
          dataType = Number.isInteger(val) ? DataType.Int32 : DataType.Double; break;
        case 'boolean':
          dataType = DataType.Boolean; break;
        case 'string':
          dataType = DataType.String; break;
        default:
          // Fallback to String
          dataType = DataType.String;
      }
      return new Variant({ dataType, value: val });
    }

    // Respect explicit dataType, support arrays with element coercion
    if (Array.isArray(val)) {
      const coercedArr = val.map(v => this._coerceJs(v, dataType));
      return new Variant({ dataType, arrayType: VariantArrayType.Array, value: coercedArr });
    }
    const coerced = this._coerceJs(val, dataType);
    return new Variant({ dataType, value: coerced });
  }

  _buildIdentity(userIdentity) {
    if (!userIdentity) return null;
    const t = String(userIdentity.type || '').toLowerCase();
    if (t === 'username') {
      const userName = userIdentity.userName ?? userIdentity.username ?? '';
      const password = userIdentity.password ?? '';
      return { type: 'UserName', userName, password };
    }
    if (t === 'anonymous' || !t) return null;
    return null;
  }

  _coerceJs(val, dataType) {
    // If dataType is a numeric built-in id (0..n), map it to enum constant
    if (typeof dataType === 'number') {
      // dataType already numeric; fall-through
    }
    switch (dataType) {
      case DataType.Boolean:
        if (typeof val === 'string') return val.toLowerCase() === 'true';
        return Boolean(val);
      case DataType.Int16:
      case DataType.Int32:
      case DataType.Int64:
      case DataType.UInt16:
      case DataType.UInt32:
      case DataType.UInt64:
        if (typeof val === 'string') {
          const n = Number(val);
          return Number.isFinite(n) ? Math.trunc(n) : val;
        }
        return Math.trunc(val);
      case DataType.Float:
      case DataType.Double:
        if (typeof val === 'string') {
          const n = Number(val);
          return Number.isFinite(n) ? n : val;
        }
        return Number(val);
      case DataType.String:
        return String(val);
      default:
        return val;
    }
  }
}

module.exports = OPCUAHandler;