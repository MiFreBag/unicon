// server/handlers/sftp_handler.js
const { Client } = require('ssh2')
const { Readable, Writable } = require('stream')

class SftpHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId
    this.config = config || {}
    this.conn = new Client()
    this.sftp = null
    this.connected = false
  }

  async connect() {
    const cfg = this.config || {}
    const host = cfg.host
    const port = Number(cfg.port || 22)
    if (!host) throw new Error('SFTP host is required')
    const auth = {
      host,
      port,
      username: cfg.username || cfg.user,
      password: cfg.password,
      privateKey: cfg.privateKey,
      passphrase: cfg.passphrase,
      readyTimeout: Number(cfg.timeoutMs || 15000)
    }
    return await new Promise((resolve, reject) => {
      this.conn
        .on('ready', () => {
          this.conn.sftp((err, sftp) => {
            if (err) return reject(err)
            this.sftp = sftp
            this.connected = true
            resolve({ success: true })
          })
        })
        .on('error', err => reject(err))
        .connect(auth)
    })
  }

  async disconnect() {
    try { if (this.sftp) this.sftp.end() } catch(_) {}
    try { this.conn.end() } catch(_) {}
    this.connected = false
    return { success: true }
  }

  _ensure() { if (!this.connected || !this.sftp) throw new Error('SFTP not connected') }

  async list(path = '.') {
    this._ensure()
    return await new Promise((resolve, reject) => {
      this.sftp.readdir(path, (err, list) => {
        if (err) return reject(err)
        // Normalize entries similar to basic-ftp
        const data = (list || []).map(e => ({
          name: e.filename,
          size: Number(e.attrs?.size || 0),
          modify: e.attrs?.mtime ? new Date(e.attrs.mtime * 1000).toISOString() : undefined,
          type: e.longname && e.longname[0] === 'd' ? 'd' : (e.attrs?.isDirectory?.() ? 'd' : 'f'),
          isDirectory: (e.longname && e.longname[0] === 'd') || (e.attrs?.isDirectory?.() === true)
        }))
        resolve({ success: true, data })
      })
    })
  }

  async uploadFromBuffer(buffer, remotePath) {
    this._ensure()
    const stream = Readable.from(buffer)
    return await new Promise((resolve, reject) => {
      const ws = this.sftp.createWriteStream(remotePath)
      ws.on('error', reject)
      ws.on('close', () => resolve({ success: true }))
      stream.pipe(ws)
    })
  }

  async uploadFromStream(readable, remotePath) {
    this._ensure()
    return await new Promise((resolve, reject) => {
      const ws = this.sftp.createWriteStream(remotePath)
      ws.on('error', reject)
      ws.on('close', () => resolve({ success: true }))
      readable.pipe(ws)
    })
  }

  async downloadToStream(stream, remotePath) {
    this._ensure()
    return await new Promise((resolve, reject) => {
      const rs = this.sftp.createReadStream(remotePath)
      rs.on('error', reject)
      rs.on('end', resolve)
      rs.pipe(stream)
    })
  }

  getReadStream(remotePath) {
    this._ensure()
    return this.sftp.createReadStream(remotePath)
  }

  async downloadToBuffer(remotePath) {
    this._ensure()
    const chunks = []
    return await new Promise((resolve, reject) => {
      const rs = this.sftp.createReadStream(remotePath)
      rs.on('error', reject)
      rs.on('data', ch => chunks.push(Buffer.from(ch)))
      rs.on('end', () => resolve(Buffer.concat(chunks)))
    })
  }

  async remove(remotePath) {
    this._ensure()
    return await new Promise((resolve, reject) => {
      // Try unlink, fallback rmdir
      this.sftp.unlink(remotePath, (err) => {
        if (!err) return resolve({ success: true })
        this.sftp.rmdir(remotePath, (err2) => err2 ? reject(err) : resolve({ success: true }))
      })
    })
  }

  async mkdir(remotePath) {
    this._ensure()
    return await new Promise((resolve, reject) => {
      this.sftp.mkdir(remotePath, { mode: 0o755 }, (err) => err ? reject(err) : resolve({ success: true }))
    })
  }

  async rename(fromPath, toPath) {
    this._ensure()
    return await new Promise((resolve, reject) => {
      this.sftp.rename(fromPath, toPath, (err) => err ? reject(err) : resolve({ success: true }))
    })
  }
}

module.exports = SftpHandler
