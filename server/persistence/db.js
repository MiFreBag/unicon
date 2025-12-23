// server/persistence/db.js
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

class DB {
  constructor(filePath) {
    this.filePath = filePath;
    this.db = null;
  }

  async init() {
    ensureDir(path.dirname(this.filePath));
    this.db = new sqlite3.Database(this.filePath);
    await this._run(`CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`);
    await this._run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`);
    await this._run(`CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    )`);
    await this._run(`CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (user_id, role_id)
    )`);
    await this._run(`CREATE TABLE IF NOT EXISTS user_prefs (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )`);
    return this;
  }

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) { if (err) reject(err); else resolve(this); });
    });
  }

  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
    });
  }

  async getConnections() {
    const rows = await this._all('SELECT id, name, type, config, createdAt FROM connections ORDER BY createdAt ASC');
    return rows.map(r => ({ id: r.id, name: r.name, type: r.type, config: JSON.parse(r.config), createdAt: r.createdAt, status: 'disconnected' }));
  }

  async upsertConnection(conn) {
    await this._run(
      `INSERT INTO connections (id, name, type, config, createdAt) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, config=excluded.config`,
      [conn.id, conn.name, conn.type, JSON.stringify(conn.config || {}), conn.createdAt]
    );
  }

  async deleteConnection(id) {
    await this._run('DELETE FROM connections WHERE id = ?', [id]);
  }

  async replaceConnections(conns) {
    await this._run('DELETE FROM connections');
    for (const c of conns) await this.upsertConnection(c);
  }

  // Auth persistence
  async createUser({ id, email, password_hash, salt, createdAt }) {
    await this._run(
      `INSERT INTO users (id, email, password_hash, salt, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [id, email, password_hash, salt, createdAt]
    );
  }

  async getUserByEmail(email) {
    const rows = await this._all('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  async ensureRole(name) {
    const rows = await this._all('SELECT * FROM roles WHERE name = ?', [name]);
    if (rows.length) return rows[0];
    const id = `${Date.now()}-${Math.random()}`;
    await this._run('INSERT INTO roles (id, name) VALUES (?, ?)', [id, name]);
    return { id, name };
  }

  async assignRoleToUser(userId, roleName) {
    const role = await this.ensureRole(roleName);
    await this._run('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, role.id]);
  }

  async getRolesForUser(userId) {
    const rows = await this._all(
      `SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?`,
      [userId]
    );
    return rows.map(r => r.name);
  }

  async setUserPref(userId, key, value) {
    await this._run(
      `INSERT INTO user_prefs (user_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value`,
      [userId, key, value]
    );
  }

  async getUserPref(userId, key) {
    const rows = await this._all('SELECT value FROM user_prefs WHERE user_id = ? AND key = ?', [userId, key]);
    return rows[0]?.value ?? null;
  }
}

module.exports = { DB };