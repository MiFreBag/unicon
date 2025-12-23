// server/handlers/ssh_handler.js
const { Client } = require('ssh2');
const { v4: uuidv4 } = require('uuid');

class SSHHandler {
  constructor(connectionId, config) {
    this.connectionId = connectionId;
    this.config = config || {};
    this.client = null;
    this.isConnected = false;
    this.shells = new Map(); // sessionId -> {stream}
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      this.client = conn;

      conn.on('ready', () => {
        this.isConnected = true;
        this._broadcast({ type: 'ssh', data: { event: 'connected', connectionId: this.connectionId } });
        resolve({ success: true });
      }).on('error', (err) => {
        reject(new Error(`SSH error: ${err.message}`));
      }).on('end', () => {
        this.isConnected = false;
        this._broadcast({ type: 'ssh', data: { event: 'ended', connectionId: this.connectionId } });
      }).on('close', () => {
        this.isConnected = false;
        this._broadcast({ type: 'ssh', data: { event: 'closed', connectionId: this.connectionId } });
      });

      const { host, port = 22, username, password, privateKey, passphrase } = this.config;
      const opts = { host, port, username };
      if (password) opts.password = password;
      if (privateKey) opts.privateKey = privateKey;
      if (passphrase) opts.passphrase = passphrase;

      conn.connect(opts);
    });
  }

  async disconnect() {
    try {
      for (const { stream } of this.shells.values()) {
        try { stream.end(); } catch (_) {}
      }
      this.shells.clear();
      if (this.client) this.client.end();
      this.isConnected = false;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async exec(command, cwd) {
    if (!this.isConnected || !this.client) throw new Error('SSH not connected');
    return new Promise((resolve, reject) => {
      this.client.exec(command, { cwd }, (err, stream) => {
        if (err) return reject(err);
        let stdout = '', stderr = '';
        stream.on('close', (code, signal) => {
          resolve({ success: true, data: { stdout, stderr, code, signal } });
        }).on('data', (data) => { stdout += data.toString('utf8'); });
        if (stream && stream.stderr && typeof stream.stderr.on === 'function') {
          stream.stderr.on('data', (data) => { stderr += data.toString('utf8'); });
        }
      });
    });
  }

  async shellOpen({ cols = 80, rows = 24 } = {}) {
    if (!this.isConnected || !this.client) throw new Error('SSH not connected');
    const sessionId = uuidv4();
    return new Promise((resolve, reject) => {
      this.client.shell({ cols, rows, term: 'xterm-color' }, (err, stream) => {
        if (err) return reject(err);
        this.shells.set(sessionId, { stream });
        stream.on('data', (data) => {
          this._broadcast({
            type: 'ssh',
            data: { event: 'shellData', sessionId, connectionId: this.connectionId, data: data.toString('utf8') }
          });
        });
        stream.on('close', () => {
          this._broadcast({ type: 'ssh', data: { event: 'shellClosed', sessionId, connectionId: this.connectionId } });
          this.shells.delete(sessionId);
        });
        resolve({ success: true, data: { sessionId } });
      });
    });
  }

  async shellInput({ sessionId, data }) {
    const entry = this.shells.get(sessionId);
    if (!entry) throw new Error('Unknown shell session');
    entry.stream.write(data);
    return { success: true };
  }

  async shellResize({ sessionId, cols, rows }) {
    const entry = this.shells.get(sessionId);
    if (!entry) throw new Error('Unknown shell session');
    try { entry.stream.setWindow(rows, cols); } catch (_) {}
    return { success: true };
  }

  async shellClose({ sessionId }) {
    const entry = this.shells.get(sessionId);
    if (!entry) return { success: true };
    try { entry.stream.end(); } catch (_) {}
    this.shells.delete(sessionId);
    return { success: true };
  }

  // ----- SFTP helpers -----
  _getSftp() {
    if (!this.client || !this.isConnected) throw new Error('SSH not connected');
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
    });
  }

  async sftpList({ path = '.' } = {}) {
    const sftp = await this._getSftp();
    return new Promise((resolve, reject) => {
      sftp.readdir(path, (err, list) => {
        if (err) return reject(err);
        const entries = (list || []).map((e) => ({ filename: e.filename, longname: e.longname || '', attrs: e.attrs }));
        resolve({ success: true, data: { entries } });
      });
    });
  }

  async sftpGet({ path }) {
    if (!path) throw new Error('path required');
    const sftp = await this._getSftp();
    return new Promise((resolve, reject) => {
      const chunks = [];
      const rs = sftp.createReadStream(path);
      rs.on('data', (c) => chunks.push(Buffer.from(c)));
      rs.on('error', (e) => reject(e));
      rs.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ success: true, data: { base64: buf.toString('base64'), size: buf.length } });
      });
    });
  }

  async sftpPut({ path, base64 }) {
    if (!path) throw new Error('path required');
    if (!base64) throw new Error('base64 required');
    const sftp = await this._getSftp();
    const buf = Buffer.from(base64, 'base64');
    return new Promise((resolve, reject) => {
      const ws = sftp.createWriteStream(path);
      ws.on('error', (e) => reject(e));
      ws.on('finish', () => resolve({ success: true, data: { size: buf.length } }));
      ws.end(buf);
    });
  }

  _broadcast(message) {
    if (global.broadcast) global.broadcast(message);
  }
}

module.exports = SSHHandler;
