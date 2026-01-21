export async function serverUpdate(id, patch) {
  const res = await fetch(`/unicon/api/templates/${encodeURIComponent(id)}`, { method:'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(patch||{}) });
  const data = await res.json();
  if (!res.ok || data?.success === false) throw new Error(data?.error || 'server error');
  return data.template;
}
export async function serverBulkDelete(ids) {
  const res = await fetch('/unicon/api/templates/bulk-delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ids }) });
  const data = await res.json();
  if (!res.ok || data?.success === false) throw new Error(data?.error || 'server error');
  return data.deleted || 0;
}

// client/src/features/examples/library.js
const KEY = 'unicon_templates_v1';

export function getLibrary() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveTemplate(tmpl) {
  const now = Date.now();
  const base = getLibrary();
  const id = tmpl.id || `${now}-${Math.random().toString(36).slice(2)}`;
  const next = base.concat([{ ...tmpl, id, ts: now }]);
  localStorage.setItem(KEY, JSON.stringify(next));
  return id;
}

export function deleteTemplate(id) {
  const next = getLibrary().filter(t => t.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function exportLibrary() {
  const data = JSON.stringify(getLibrary(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'unicon-library.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importLibrary(file) {
  const text = await file.text();
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error('Invalid library file');
  localStorage.setItem(KEY, JSON.stringify(arr));
}

// Remote helpers (optional backend persistence)
export async function serverList() {
  const res = await fetch('/unicon/api/templates');
  const data = await res.json();
  if (!res.ok || data?.success === false) throw new Error(data?.error || 'server error');
  return data.templates || [];
}
export async function serverAdd(tmpl) {
  const res = await fetch('/unicon/api/templates', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(tmpl) });
  const data = await res.json();
  if (!res.ok || data?.success === false) throw new Error(data?.error || 'server error');
  return data.template;
}
export async function serverDelete(id) {
  const res = await fetch(`/unicon/api/templates/${encodeURIComponent(id)}`, { method:'DELETE' });
  const data = await res.json().catch(()=>({success:true}));
  if (!res.ok || data?.success === false) throw new Error(data?.error || 'server error');
}
export async function serverImport(list) {
  const res = await fetch('/unicon/api/templates/import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ templates: list }) });
  const data = await res.json();
  if (!res.ok || data?.success === false) throw new Error(data?.error || 'server error');
  return data.count || 0;
}
