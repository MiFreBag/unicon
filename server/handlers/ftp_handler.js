// server/handlers/ftp_handler.js
const ftp = require('basic-ftp')

class FtpHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId
    this.config = config || {}
    this.client = new ftp.Client(Number(config.timeoutMs || 10000))
    this.connected = false
  }

  async connect() {
    const host = this.config.host
    const port = Number(this.config.port || 21)
    if (!host) throw new Error('FTP host is required')
    try {
      await this.client.access({
        host,
        port,
        user: this.config.user,
        password: this.config.password,
        secure: !!this.config.secure,
        passive: this.config.passive !== false,
      })
      this.connected = true
      return { success: true }
    } catch (e) {
      try { this.client.close() } catch (_) {}
      throw e
    }
  }

  async disconnect() {
    try { await this.client.close() } catch (_) {}
    this.connected = false
    return { success: true }
  }

  async list(path = '.') {
    if (!this.connected) throw new Error('FTP not connected')
    const listing = await this.client.list(path)
    return { success: true, data: listing }
  }

  async uploadFromBuffer(buffer, remotePath) {
    if (!this.connected) throw new Error('FTP not connected')
    const { Readable } = require('stream')
    const stream = Readable.from(buffer)
    await this.client.uploadFrom(stream, remotePath)
    return { success: true }
  }

  async downloadToStream(stream, remotePath) {
    if (!this.connected) throw new Error('FTP not connected')
    await this.client.downloadTo(stream, remotePath)
  }

  async downloadToBuffer(remotePath) {
    if (!this.connected) throw new Error('FTP not connected')
    const chunks = []
    const { Writable } = require('stream')
    const sink = new Writable({
      write(chunk, enc, cb) { chunks.push(Buffer.from(chunk)); cb() }
    })
    await this.client.downloadTo(sink, remotePath)
    return Buffer.concat(chunks)
  }

  async remove(remotePath) {
    if (!this.connected) throw new Error('FTP not connected')
    try {
      await this.client.remove(remotePath)
    } catch (e) {
      // If it is a directory, try removeDir
      try { await this.client.removeDir(remotePath) } catch (_) { throw e }
    }
    return { success: true }
  }

  async mkdir(remotePath) {
    if (!this.connected) throw new Error('FTP not connected')
    await this.client.ensureDir(remotePath)
    return { success: true }
  }

  async rename(fromPath, toPath) {
    if (!this.connected) throw new Error('FTP not connected')
    await this.client.rename(fromPath, toPath)
    return { success: true }
  }
}

module.exports = FtpHandler
