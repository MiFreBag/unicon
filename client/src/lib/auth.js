// client/src/lib/auth.js
const KEY = 'unicon_token_v1';
const ROLES_KEY = 'unicon_roles_v1';

export function setToken(token, roles = []) {
  try { localStorage.setItem(KEY, token); } catch {}
  try { localStorage.setItem(ROLES_KEY, JSON.stringify(roles)); } catch {}
}
export function getToken() {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}
export function getRoles() {
  try { return JSON.parse(localStorage.getItem(ROLES_KEY) || '[]'); } catch { return []; }
}
export function clearAuth() {
  try { localStorage.removeItem(KEY); } catch {}
  try { localStorage.removeItem(ROLES_KEY); } catch {}
}