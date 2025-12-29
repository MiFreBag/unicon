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
}

module.exports = FtpHandler
