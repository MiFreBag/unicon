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
    // Workspaces and mapping (one workspace per connection for v1)
    await this._run(`CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )`);
    await this._run(`CREATE TABLE IF NOT EXISTS connection_workspaces (
      connection_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL
    )`);
    await this._run(`CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY (workspace_id, user_id)
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
    await this._run(`CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      linked_at TEXT NOT NULL,
      UNIQUE(user_id, provider)
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

  async getConnections(workspaceId = null) {
    if (workspaceId) {
      const rows = await this._all(`
        SELECT c.id, c.name, c.type, c.config, c.createdAt, cw.workspace_id as workspaceId
        FROM connections c
        JOIN connection_workspaces cw ON cw.connection_id = c.id
        WHERE cw.workspace_id = ?
        ORDER BY c.createdAt ASC`, [workspaceId]);
      return rows.map(r => ({ id: r.id, name: r.name, type: r.type, config: JSON.parse(r.config), createdAt: r.createdAt, workspaceId: r.workspaceId, status: 'disconnected' }));
    } else {
      const rows = await this._all('SELECT id, name, type, config, createdAt FROM connections ORDER BY createdAt ASC');
      // attach workspace if present
      const map = new Map((await this._all('SELECT connection_id, workspace_id FROM connection_workspaces')).map(r => [r.connection_id, r.workspace_id]));
      return rows.map(r => ({ id: r.id, name: r.name, type: r.type, config: JSON.parse(r.config), createdAt: r.createdAt, workspaceId: map.get(r.id) || null, status: 'disconnected' }));
    }
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
    await this._run('DELETE FROM connection_workspaces');
    for (const c of conns) {
      await this.upsertConnection(c);
      if (c.workspaceId) await this.assignConnectionToWorkspace(c.id, c.workspaceId);
    }
  }

  // Workspace persistence (v1)
  async listWorkspaces() {
    const rows = await this._all('SELECT id, name, createdAt FROM workspaces ORDER BY createdAt ASC');
    return rows;
  }

  async createWorkspace({ id, name, createdAt }) {
    await this._run('INSERT INTO workspaces (id, name, createdAt) VALUES (?, ?, ?)', [id, name, createdAt]);
  }

  async updateWorkspaceName(id, name) {
    await this._run('UPDATE workspaces SET name = ? WHERE id = ?', [name, id]);
  }

  async deleteWorkspace(id) {
    await this._run('DELETE FROM workspaces WHERE id = ?', [id]);
    await this._run('DELETE FROM connection_workspaces WHERE workspace_id = ?', [id]);
    await this._run('DELETE FROM workspace_members WHERE workspace_id = ?', [id]);
  }

  async assignConnectionToWorkspace(connectionId, workspaceId) {
    if (!workspaceId) {
      await this._run('DELETE FROM connection_workspaces WHERE connection_id = ?', [connectionId]);
      return;
    }
    await this._run(`INSERT INTO connection_workspaces (connection_id, workspace_id) VALUES (?, ?)
                     ON CONFLICT(connection_id) DO UPDATE SET workspace_id=excluded.workspace_id`, [connectionId, workspaceId]);
  }

  // Workspace membership (RBAC v1)
  async listWorkspaceMembers(workspaceId) {
    return await this._all('SELECT workspace_id as workspaceId, user_id as userId, role FROM workspace_members WHERE workspace_id = ?', [workspaceId]);
  }
  async addWorkspaceMember(workspaceId, userId, role) {
    await this._run(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)
                     ON CONFLICT(workspace_id, user_id) DO UPDATE SET role=excluded.role`, [workspaceId, userId, role]);
  }
  async removeWorkspaceMember(workspaceId, userId) {
    await this._run('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [workspaceId, userId]);
  }
  async getWorkspaceRole(userId, workspaceId) {
    const rows = await this._all('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [workspaceId, userId]);
    return rows[0]?.role || null;
  }
  async listWorkspacesForUser(userId) {
    return await this._all(`SELECT w.id, w.name, w.createdAt FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id WHERE m.user_id = ? ORDER BY w.createdAt ASC`, [userId]);
  }

  async transferWorkspaceOwner(workspaceId, newOwnerUserId) {
    // demote existing owner(s) to admin, promote new owner
    await this._run(`UPDATE workspace_members SET role='admin' WHERE workspace_id = ? AND role = 'owner'`, [workspaceId]);
    await this._run(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')
                     ON CONFLICT(workspace_id, user_id) DO UPDATE SET role='owner'`, [workspaceId, newOwnerUserId]);
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

  async deleteUserPref(userId, key) {
    await this._run('DELETE FROM user_prefs WHERE user_id = ? AND key = ?', [userId, key]);
  }

  async upsertOauthAccount({ id, user_id, provider, provider_user_id, linked_at }) {
    await this._run(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, linked_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, provider) DO UPDATE SET provider_user_id=excluded.provider_user_id, linked_at=excluded.linked_at`,
      [id, user_id, provider, provider_user_id, linked_at]
    );
  }

  async deleteOauthAccount(user_id, provider) {
    await this._run('DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?', [user_id, provider]);
  }

  async listOauthAccounts(user_id) {
    return await this._all('SELECT provider, provider_user_id, linked_at FROM oauth_accounts WHERE user_id = ?', [user_id]);
  }
}

module.exports = { DB };
