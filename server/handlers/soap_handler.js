// server/handlers/soap_handler.js
const path = require('path');

class SoapHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId;
    this.config = config || {};
    this.client = null;
    this.connected = false;
    this.soap = null;
  }

  async connect() {
    const wsdlUrl = this.config.wsdlUrl || this.config.url || this.config.wsdl;
    if (!wsdlUrl) throw new Error('wsdlUrl is required');

    // Lazy-load to avoid adding startup cost if SOAP unused
    this.soap = require('soap');

    const options = {
      // Allow overriding endpoint and timeouts
      endpoint: this.config.endpoint || undefined,
      wsdl_headers: this.config.wsdlHeaders || undefined,
      wsdl_options: this.config.wsdlOptions || undefined,
      disableCache: this.config.disableCache === true,
      request: this.config.request || undefined,
      timeout: Number(this.config.timeoutMs || 15000)
    };

    const client = await this.soap.createClientAsync(wsdlUrl, options);

    // Security
    const auth = this.config.auth || this.config.security || {};
    const kind = (auth.type || auth.kind || '').toLowerCase();
    if (kind === 'basic' && (auth.username || auth.user)) {
      client.setSecurity(new this.soap.BasicAuthSecurity(auth.username || auth.user, auth.password || ''));
    } else if (kind === 'wsse' || kind === 'wss') {
      const hasTimeStamp = auth.hasTimeStamp !== false;
      client.setSecurity(new this.soap.WSSecurity(auth.username || auth.user || '', auth.password || '', { hasTimeStamp }));
    }

    // SOAP headers (static)
    if (Array.isArray(this.config.soapHeaders)) {
      for (const h of this.config.soapHeaders) client.addSoapHeader(h);
    } else if (this.config.soapHeader) {
      client.addSoapHeader(this.config.soapHeader);
    }

    this.client = client;
    this.connected = true;
    return { success: true };
  }

  async disconnect() {
    this.client = null;
    this.connected = false;
    return { success: true };
  }

  _ensure() { if (!this.connected || !this.client) throw new Error('SOAP not connected'); }

  describe() {
    this._ensure();
    // Map into a compact list for UI usage
    const desc = this.client.describe();
    const flat = [];
    for (const [svcName, svc] of Object.entries(desc || {})) {
      for (const [portName, port] of Object.entries(svc || {})) {
        for (const methodName of Object.keys(port || {})) {
          flat.push({ service: svcName, port: portName, method: methodName, fqmn: `${svcName}.${portName}.${methodName}` });
        }
      }
    }
    return { success: true, data: { services: desc, operations: flat } };
  }

  async invoke(method, args = {}, options = {}) {
    this._ensure();
    if (!method) throw new Error('method required');

    // Resolve method reference
    let fn = this.client[method];
    if (typeof fn !== 'function') {
      // Try dotted path Service.Port.Method
      const parts = String(method).split('.');
      if (parts.length === 3 && this.client?.services?.[parts[0]]?.[parts[1]]?.[parts[2]]) {
        fn = this.client.services[parts[0]][parts[1]][parts[2]].bind(this.client);
      }
    }
    if (typeof fn !== 'function') throw new Error(`Unknown SOAP method: ${method}`);

    // Optional per-call headers
    if (options?.soapHeaders) {
      // Clear prev dynamic headers by resetting last added indices (node-soap accumulates); create a proxy client for this call if needed
      // Simpler approach: add provided headers then call; they affect only this request
      for (const h of [].concat(options.soapHeaders)) this.client.addSoapHeader(h);
    }

    // Endpoint override per call
    if (options?.endpoint) this.client.setEndpoint(options.endpoint);

    // Extra http headers
    const extraHttpHeaders = options?.httpHeaders || {};

    // Call async
    const timeout = Number(options?.timeoutMs || this.config.timeoutMs || 15000);
    const p = fnAsync(fn, args, { timeout, headers: extraHttpHeaders });
    const [result, rawResponse, soapHeader, rawRequest] = await p;

    const includeRaw = options?.includeRaw || this.config.includeRaw === true;
    return {
      success: true,
      data: result,
      ...(includeRaw ? { rawResponse, rawRequest, soapHeader } : {})
    };
  }
}

function fnAsync(boundFn, args, meta) {
  // Normalize to node-soap Promise signature
  return new Promise((resolve, reject) => {
    try {
      boundFn(args, meta, (err, result, rawResponse, soapHeader, rawRequest) => {
        if (err) return reject(err);
        resolve([result, rawResponse, soapHeader, rawRequest]);
      });
    } catch (e) { reject(e); }
  });
}

module.exports = SoapHandler;