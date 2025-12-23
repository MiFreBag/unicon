const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const bcrypt = require('bcryptjs');
const { issueJWT, verifyJWT } = require('./middleware');

module.exports = function createAuthRouter(db) {
  // Fallback in-memory if no db
  const mem = new Map();
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, error: 'email and password required' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    try {
      if (db) {
        const exists = await db.getUserByEmail(email);
        if (exists) return res.status(409).json({ success: false, error: 'user exists' });
        await db.createUser({ id: uuidv4(), email, password_hash: hash, salt, createdAt: new Date().toISOString() });
        await db.assignRoleToUser((await db.getUserByEmail(email)).id, 'developer');
      } else {
        if (mem.has(email)) return res.status(409).json({ success: false, error: 'user exists' });
        mem.set(email, { email, hash, salt, roles: ['developer'] });
      }
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    try {
      let user, roles;
      if (db) {
        user = await db.getUserByEmail(email);
        roles = user ? await db.getRolesForUser(user.id) : [];
        if (!user) return res.status(401).json({ success: false, error: 'invalid credentials' });
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ success: false, error: 'invalid credentials' });
      } else {
        const u = mem.get(email);
        if (!u) return res.status(401).json({ success: false, error: 'invalid credentials' });
        // In-memory users are stored with bcrypt hashes in /register. Compare using bcrypt.
        const ok = await bcrypt.compare(password, u.hash);
        if (!ok) return res.status(401).json({ success: false, error: 'invalid credentials' });
        roles = u.roles;
      }
      const token = issueJWT({ id: user ? user.id : email, email, roles });
      return res.json({ success: true, token, roles });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Demo forgot password endpoint (no email delivery in demo)
  router.post('/forgot', async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, error: 'email required' });
    // In a real system, generate and email a token. For demo, return a reset URL.
    const token = crypto.randomBytes(16).toString('hex');
    const origin = `${req.protocol}://${req.get('host')}`;
    const reset_url = `${origin}/unicon/auth/reset?token=${token}`;
    return res.json({ success: true, reset_url });
  });

  router.post('/logout', (req,res) => { return res.json({ success: true }); });

  // Unlink external OAuth provider account for current user
  router.delete('/oauth/:provider', verifyJWT, async (req, res) => {
    try {
      const provider = req.params.provider;
      // remove linked account
      if (db?.deleteOauthAccount) await db.deleteOauthAccount(req.user.sub, provider);
      // clear current provider preference if it matches
      const current = await db.getUserPref(req.user.sub, 'provider');
      if (current === provider) await db.deleteUserPref(req.user.sub, 'provider');
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  return router;
};
