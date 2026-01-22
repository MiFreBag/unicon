// client/src/lib/api.js
const API_BASE = '/unicon/api';

import { getToken } from './auth';

export async function apiPost(path, body, method = 'POST') {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const error = data?.error || res.statusText;
    throw new Error(error);
  }
  return data;
}

export async function apiGet(path) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const error = data?.error || res.statusText;
    throw new Error(error);
  }
  return data;
}

function currentWorkspaceId() {
  try { return localStorage.getItem('unicon_current_workspace_v1') || null; } catch { return null; }
}

export async function listConnections() {
  const ws = currentWorkspaceId();
  return apiGet(ws ? `/connections?workspaceId=${encodeURIComponent(ws)}` : '/connections');
}

export async function createConnection(payload) {
  const ws = currentWorkspaceId();
  const body = ws ? { ...payload, workspaceId: ws } : payload;
  return apiPost('/connections', body);
}

export async function deleteConnection(id) {
  return fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE' })
    .then(r => r.json());
}

export async function updateConnection(id, payload) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/connections/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const error = data?.error || res.statusText;
    throw new Error(error);
  }
  return data;
}

export async function connectConnection(connectionId) {
  return apiPost('/connect', { connectionId });
}

export async function disconnectConnection(connectionId) {
  return apiPost('/disconnect', { connectionId });
}

export async function op(connectionId, operation, params = {}) {
  return apiPost('/operation', { connectionId, operation, params });
}

// Workspaces API
export async function listWorkspaces() {
  return apiGet('/workspaces');
}
export async function createWorkspace(name) {
  return apiPost('/workspaces', { name });
}
export async function updateWorkspace(id, name) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/workspaces/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    body: JSON.stringify({ name })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) { throw new Error(data?.error || res.statusText); }
  return data;
}
export async function deleteWorkspace(id) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/workspaces/${id}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) { throw new Error(data?.error || res.statusText); }
  return data;
}

// Workspace members
export async function listWorkspaceMembers(id) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/workspaces/${id}/members`, { headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.success === false) { const err = new Error(data?.error || res.statusText); err.status = res.status; throw err; }
  return data;
}
export async function addWorkspaceMember(id, userId, role) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/workspaces/${id}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify({ userId, role }) });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.success === false) { throw new Error(data?.error || res.statusText); }
  return data;
}
export async function updateWorkspaceMember(id, userId, role) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/workspaces/${id}/members/${encodeURIComponent(userId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify({ role }) });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.success === false) { throw new Error(data?.error || res.statusText); }
  return data;
}
export async function removeWorkspaceMember(id, userId) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/workspaces/${id}/members/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.success === false) { throw new Error(data?.error || res.statusText); }
  return data;
}
export async function transferWorkspaceOwner(id, toUserId) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/workspaces/${id}/owner-transfer`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify({ toUserId }) });
  const data = await res.json().catch(()=>({}));
  if (!res.ok || data?.success === false) { throw new Error(data?.error || res.statusText); }
  return data;
}
