// client/src/lib/api.js
const API_BASE = '/unicon/api';

import { getToken } from './auth';

export async function apiPost(path, body) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
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

export async function listConnections() {
  return apiGet('/connections');
}

export async function createConnection(payload) {
  return apiPost('/connections', payload);
}

export async function deleteConnection(id) {
  return fetch(`${API_BASE}/connections/${id}`, { method: 'DELETE' })
    .then(r => r.json());
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
