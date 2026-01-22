// server/handlers/localfs_handler.js
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

class LocalFSHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId;
    this.config = config || {};
    this.root = path.resolve(this.config.root || path.join(__dirname, '..', 'data', 'localfs'));
    this.connected = false;
  }

  async connect() {
    await fsp.mkdir(this.root, { recursive: true });
    this.connected = true;
    return { success: true, root: this.root };
  }

  async disconnect() { this.connected = false; return { success: true }; }

  _ensure() { if (!this.connected) throw new Error('LocalFS not connected'); }

  _safe(p = '.') {
    const rel = (p == null || p === '') ? '.' : String(p);
    const joined = path.resolve(this.root, rel);
    if (!joined.startsWith(this.root)) throw new Error('Path escapes root');
    return joined;
  }

  async list(dir = '.') {
    this._ensure();
    const abs = this._safe(dir);
    const names = await fsp.readdir(abs, { withFileTypes: true });
    const entries = [];
    for (const d of names) {
      const full = path.join(abs, d.name);
      let st = null; try { st = await fsp.stat(full); } catch (_) {}
      entries.push({
        name: d.name,
        size: st ? Number(st.size) : 0,
        modify: st ? new Date(st.mtimeMs).toISOString() : undefined,
        isDirectory: d.isDirectory(),
        type: d.isDirectory() ? 'd' : 'f'
      });
    }
    return { success: true, data: entries };
  }

  async mkdir(target) {
    this._ensure();
    const abs = this._safe(target);
    await fsp.mkdir(abs, { recursive: true });
    return { success: true };
  }

  async rename(fromPath, toPath) {
    this._ensure();
    const from = this._safe(fromPath);
    const to = this._safe(toPath);
    await fsp.rename(from, to);
    return { success: true };
  }

  async remove(target) {
    this._ensure();
    const abs = this._safe(target);
    // Try file unlink first, fallback to recursive dir removal
    try { await fsp.unlink(abs); }
    catch (e) {
      if (e && e.code === 'EISDIR' || e.code === 'EPERM' || e.code === 'EACCES') {
        await fsp.rm(abs, { recursive: true, force: true });
      } else if (e && e.code === 'ENOENT') {
        return { success: true }; // already gone
      } else {
        throw e;
      }
    }
    return { success: true };
  }

  async download(p) {
    this._ensure();
    const abs = this._safe(p);
    const buf = await fsp.readFile(abs);
    return { success: true, data: { base64: buf.toString('base64'), size: buf.length } };
  }

  getReadStream(p) {
    this._ensure();
    const abs = this._safe(p);
    return fs.createReadStream(abs);
  }

  async upload(p, base64, overwrite = true) {
    this._ensure();
    if (!base64) throw new Error('base64 required');
    const abs = this._safe(p);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    const flag = overwrite ? 'w' : 'wx';
    await fsp.writeFile(abs, Buffer.from(base64, 'base64'), { flag });
    return { success: true };
  }

  async uploadFromStream(readable, p, overwrite = true) {
    this._ensure();
    const abs = this._safe(p);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    const flag = overwrite ? 'w' : 'wx';
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(abs, { flags: flag });
      ws.on('error', reject);
      ws.on('finish', resolve);
      readable.pipe(ws);
    });
    return { success: true };
  }
}

module.exports = LocalFSHandler;
