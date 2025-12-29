// server/handlers/sql_handler.js
// Minimal SQL handler: sqlite (default), with optional pg/mysql2 support

class SQLHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId;
    this.config = config;
    const raw = (config.driver || 'sqlite').toLowerCase();
    const map = { postgresql: 'pg', postgres: 'pg', timescaledb: 'pg', tsdb: 'pg', mariadb: 'mysql' };
    this.driver = map[raw] || raw;
    this.client = null; // sqlite Database or pg Pool or mysql2 Pool
  }

  async connect() {
    if (this.driver === 'sqlite') {
      const sqlite3 = require('sqlite3');
      const { Database } = sqlite3;
      const filename = this.config.filename || ':memory:';
      await new Promise((resolve, reject) => {
        this.client = new Database(filename, (err) => (err ? reject(err) : resolve()));
      });
      // Pragmas for reliability
      await this._run('PRAGMA journal_mode=WAL;');
      await this._run('PRAGMA foreign_keys=ON;');
      return { success: true, data: { driver: 'sqlite', filename } };
    }

    if (this.driver === 'pg') {
      const { Pool } = require('pg');
      this.client = new Pool({ connectionString: this.config.url || this.config.connectionString });
      // simple test
      await this.client.query('SELECT 1');
      return { success: true, data: { driver: 'pg' } };
    }

    if (this.driver === 'mysql') {
      const mysql = require('mysql2/promise');
      this.client = await mysql.createPool({ uri: this.config.url || this.config.connectionString });
      await this.client.query('SELECT 1');
      return { success: true, data: { driver: 'mysql' } };
    }

    throw new Error(`Unsupported SQL driver: ${this.driver}`);
  }

  async disconnect() {
    if (!this.client) return { success: true };
    try {
      if (this.driver === 'sqlite') {
        await new Promise((resolve) => this.client.close(() => resolve()));
      } else if (this.driver === 'pg') {
        await this.client.end();
      } else if (this.driver === 'mysql') {
        await this.client.end();
      }
    } catch (_) {}
    this.client = null;
    return { success: true };
  }

  async query(sql, params = []) {
    if (!this.client) throw new Error('SQL not connected');
    if (typeof sql !== 'string' || !sql.trim()) throw new Error('SQL statement required');

    if (this.driver === 'sqlite') {
      const isSelect = /^\s*select\s/i.test(sql);
      if (isSelect) {
        const rows = await this._all(sql, params);
        return { success: true, data: { rows } };
      }
      const { changes, lastID } = await this._run(sql, params);
      return { success: true, data: { changes, lastID } };
    }

    if (this.driver === 'pg') {
      const res = await this.client.query(sql, params);
      return { success: true, data: { rows: res.rows, rowCount: res.rowCount } };
    }

    if (this.driver === 'mysql') {
      const [rows] = await this.client.query(sql, params);
      // rows is array for SELECT, OkPacket for DML
      if (Array.isArray(rows)) return { success: true, data: { rows } };
      return { success: true, data: rows };
    }

    throw new Error('Driver not initialized');
  }

  // sqlite helpers
  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.client.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  }

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.client.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}

module.exports = SQLHandler;
