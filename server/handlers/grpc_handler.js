// server/handlers/grpc_handler.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class GrpcHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId;
    this.config = config;
    this.client = null;
  }

  async connect() {
    // Minimal: create client from proto if provided
    if (!this.config.address || !this.config.proto || !this.config.package || !this.config.service) {
      // Allow connecting later when details provided
      return { success: true, message: 'gRPC config incomplete; ready for later init' };
    }
    const defs = await this._loadProto(this.config.proto);
    const svc = this._lookup(defs, this.config.package, this.config.service);
    this.client = new svc(this.config.address, grpc.credentials.createInsecure());
    return { success: true };
  }

  async disconnect() {
    if (this.client && this.client.close) this.client.close();
    this.client = null;
    return { success: true };
  }

  // Example unary call
  async unary(method, request) {
    if (!this.client || !this.client[method]) throw new Error('Client or method not available');
    return new Promise((resolve, reject) => {
      this.client[method](request, (err, resp) => {
        if (err) return reject(err);
        resolve({ success: true, data: resp });
      });
    });
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

  _lookup(defs, pkgName, svcName) {
    const parts = pkgName.split('.');
    let cur = defs;
    for (const p of parts) cur = cur[p];
    return cur[svcName];
  }
}

module.exports = GrpcHandler;