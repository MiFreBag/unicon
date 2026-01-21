import React from 'react';
import { serverList, serverAdd, serverDelete, serverImport, serverUpdate, serverBulkDelete } from '../examples/library.js';

export default function TemplatesAdmin() {
  const [list, setList] = React.useState([]);
  const [q, setQ] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set());
  const [editing, setEditing] = React.useState({}); // id -> {name,type,tags}
  const [creating, setCreating] = React.useState({ name: '', type: 'rest', tags: '', config: '{\n  "baseUrl": "https://example.com"\n}' });
  const importRef = React.useRef(null);

  const load = React.useCallback(async () => {
    setBusy(true);
    try { setList(await serverList()); } finally { setBusy(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list || []).filter(t => {
      if (typeFilter && String(t.type).toLowerCase() !== typeFilter) return false;
      if (!needle) return true;
      const hay = `${t.name} ${t.type} ${(t.tags||[]).join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [list, q, typeFilter]);

  async function onCreate() {
    try {
      const cfg = JSON.parse(creating.config || '{}');
      const tags = creating.tags.split(',').map(s=>s.trim()).filter(Boolean);
      await serverAdd({ name: creating.name.trim(), type: creating.type, config: cfg, tags });
      setCreating({ name: '', type: creating.type, tags: '', config: '{\n}\n' });
      await load();
    } catch (e) { alert(e.message || 'Create failed'); }
  }

  async function onDelete(id) { if (!confirm('Delete template?')) return; await serverDelete(id); await load(); }
  async function onBulkDelete() { if (!selected.size) return; if (!confirm(`Delete ${selected.size} templates?`)) return; await serverBulkDelete(Array.from(selected)); setSelected(new Set()); await load(); }
  function toggle(id) { setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { const all = filtered.map(t=>t.id); const allSelected = all.every(id => selected.has(id)); setSelected(new Set(allSelected ? [] : all)); }
  function startEdit(t){
    let cfg = '';
    try { cfg = JSON.stringify(t.config ?? {}, null, 2); } catch { cfg = '{}'; }
    setEditing(prev => ({ ...prev, [t.id]: { name: t.name, type: t.type, tags: (t.tags||[]).join(', '), config: cfg, configError: '' } }));
  }
  function cancelEdit(id){ setEditing(prev => { const n = { ...prev }; delete n[id]; return n; }); }
  function onEditKey(id, e){
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(id); return; }
    if (e.key === 'Enter') {
      const tag = (e.target?.tagName||'').toUpperCase();
      // Save on Enter for single-line fields; for textarea require Ctrl/Cmd+Enter
      if (tag === 'TEXTAREA') { if (e.ctrlKey || e.metaKey) { e.preventDefault(); saveEdit(id); } }
      else { e.preventDefault(); saveEdit(id); }
    }
  }
  async function saveEdit(id){
    try {
      const e = editing[id];
      const tags = String(e.tags||'').split(',').map(s=>s.trim()).filter(Boolean);
      let cfg = undefined;
      if (e.config != null) {
        try { cfg = JSON.parse(e.config || '{}'); }
        catch (parseErr) { setEditing(p=>({...p,[id]:{...p[id], configError: String(parseErr.message||'Invalid JSON')}})); return; }
      }
      await serverUpdate(id, { name: e.name, type: e.type, tags, ...(cfg!==undefined?{config:cfg}:{}) });
      cancelEdit(id); await load();
    } catch (er){ alert(er.message||'Update failed'); }
  }
  async function onClone(t) {
    try {
      const name = `${t.name} (copy)`;
      const created = await serverAdd({ name, type: t.type, tags: Array.isArray(t.tags)?t.tags:[], config: t.config || {} });
      // Pre-open edit mode for the clone
      let cfg = '{}'; try { cfg = JSON.stringify(created.config ?? {}, null, 2); } catch { cfg = '{}'; }
      setEditing(prev => ({ ...prev, [created.id]: { name: created.name, type: created.type, tags: (created.tags||[]).join(', '), config: cfg, configError: '' } }));
      await load();
    } catch (e) { alert(e.message || 'Clone failed'); }
  }

  async function onImport(file) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const arr = Array.isArray(payload) ? payload : (payload.templates||[]);
      await serverImport(arr);
      await load();
    } catch (e) { alert(e.message || 'Import failed'); }
  }

  const types = React.useMemo(() => Array.from(new Set((list||[]).map(t=>String(t.type||'').toLowerCase()))), [list]);
  const allTags = React.useMemo(() => {
    const s = new Set(); (list||[]).forEach(t => (t.tags||[]).forEach(tag => s.add(tag)));
    return Array.from(s).sort();
  }, [list]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Templates (Server)</h2>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 border rounded" onClick={load} disabled={busy}>{busy ? 'Syncing…' : 'Sync'}</button>
          <button className="px-3 py-1.5 border rounded" onClick={()=>importRef.current?.click()}>Import</button>
          <a className="px-3 py-1.5 border rounded" href="/unicon/api/templates/export">Export</a>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if (f) onImport(f); e.target.value=''; }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" aria-label="Select all" onChange={toggleAll} checked={filtered.length>0 && filtered.every(t=>selected.has(t.id))} />
        <button className="px-3 py-1.5 border rounded" onClick={onBulkDelete} disabled={!selected.size}>Delete selected</button>
        <input className="border rounded px-3 py-1.5 flex-1" placeholder="Search by name/type/tag" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="border rounded px-2 py-1.5" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(t => (
          <div key={t.id} className={`border rounded p-3 ${selected.has(t.id)?'bg-blue-50':''}`}>
            <div className="flex items-center justify-between">
              <div className="mr-2"><input type="checkbox" checked={selected.has(t.id)} onChange={()=>toggle(t.id)} /></div>
              <div className="flex-1">
                {editing[t.id] ? (
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <input className="border rounded px-2 py-1 text-sm" value={editing[t.id].name} onKeyDown={e=>onEditKey(t.id, e)} onChange={e=>setEditing(p=>({...p,[t.id]:{...p[t.id], name:e.target.value}}))} />
                    <select className="border rounded px-2 py-1 text-sm" value={editing[t.id].type} onKeyDown={e=>onEditKey(t.id, e)} onChange={e=>setEditing(p=>({...p,[t.id]:{...p[t.id], type:e.target.value}}))}>
                      {['rest','websocket','opc-ua','sql','grpc','cpd','ssh','ftp','sftp','k8s'].map(x=>(<option key={x} value={x}>{x}</option>))}
                    </select>
                    <div>
                      <input className="border rounded px-2 py-1 text-sm w-full" placeholder="tag1, tag2" value={editing[t.id].tags} onKeyDown={e=>onEditKey(t.id, e)} onChange={e=>setEditing(p=>({...p,[t.id]:{...p[t.id], tags:e.target.value}}))} />
                      {allTags.length>0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {allTags.filter(tag => !String(editing[t.id].tags||'').toLowerCase().split(',').map(s=>s.trim()).includes(tag.toLowerCase())).slice(0,8).map(tag => (
                            <button key={tag} className="text-xs px-2 py-0.5 border rounded hover:bg-gray-50" onClick={()=>{
                              setEditing(p=>{ const cur = p[t.id]; const curTags = String(cur.tags||'').split(',').map(s=>s.trim()).filter(Boolean); if (!curTags.includes(tag)) curTags.push(tag); return { ...p, [t.id]: { ...cur, tags: curTags.join(', ') } }; });
                            }}>{tag}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-gray-500">{String(t.type).toUpperCase()}</div>
                  </>
                )}
              </div>
              {editing[t.id] ? (
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-sm border rounded bg-blue-600 text-white" onClick={()=>saveEdit(t.id)} disabled={!!editing[t.id].configError}>Save</button>
                  <button className="px-2 py-1 text-sm border rounded" onClick={()=>cancelEdit(t.id)}>Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 text-sm border rounded" onClick={()=>startEdit(t)}>Edit</button>
                  <button className="px-2 py-1 text-sm border rounded" onClick={()=>onClone(t)}>Clone</button>
                  <button className="px-2 py-1 text-sm border rounded" onClick={()=>onDelete(t.id)}>Delete</button>
                </div>
              )}
            </div>
            {editing[t.id] ? (
              <div className="mt-3">
                <div className="text-xs text-gray-600 mb-1">Config (JSON)</div>
                <textarea rows={8} className={`w-full border rounded px-2 py-1 font-mono text-xs ${editing[t.id].configError ? 'border-red-500' : ''}`} value={editing[t.id].config}
                  onKeyDown={e=>onEditKey(t.id, e)}
                  onChange={e=>setEditing(p=>({...p,[t.id]:{...p[t.id], config:e.target.value, configError:''}}))} />
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <button className="px-2 py-0.5 border rounded" onClick={()=>{
                    try { const pretty = JSON.stringify(JSON.parse(editing[t.id].config||'{}'), null, 2); setEditing(p=>({...p,[t.id]:{...p[t.id], config: pretty, configError:''}})); }
                    catch (e){ setEditing(p=>({...p,[t.id]:{...p[t.id], configError: String(e.message||'Invalid JSON')}})); }
                  }}>Format</button>
                  {editing[t.id].configError && <span className="text-red-600">{editing[t.id].configError}</span>}
                </div>
              </div>
            ) : (
              <>
                {Array.isArray(t.tags) && t.tags.length>0 && (
                  <div className="mt-2 text-xs text-gray-600">Tags: {t.tags.join(', ')}</div>
                )}
                <div className="mt-2 text-xs text-gray-500">Updated: {new Date(t.ts || Date.now()).toLocaleString()}</div>
              </>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-gray-500">No templates</div>
        )}
      </div>

      <div className="border rounded p-3">
        <div className="font-medium mb-2">Create new template</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input className="w-full border rounded px-3 py-1.5" value={creating.name} onChange={e=>setCreating(p=>({...p,name:e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Type</label>
            <select className="w-full border rounded px-3 py-1.5" value={creating.type} onChange={e=>setCreating(p=>({...p,type:e.target.value}))}>
              {['rest','websocket','opc-ua','sql','grpc','cpd','ssh','ftp','sftp','k8s'].map(t=>(<option key={t} value={t}>{t}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Tags (comma-separated)</label>
            <input className="w-full border rounded px-3 py-1.5" value={creating.tags} onChange={e=>setCreating(p=>({...p,tags:e.target.value}))} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Config (JSON)</label>
            <textarea rows={8} className="w-full border rounded px-3 py-2 font-mono text-sm" value={creating.config} onChange={e=>setCreating(p=>({...p,config:e.target.value}))} />
          </div>
        </div>
        <div className="mt-3">
          <button className="px-3 py-1.5 border rounded bg-blue-600 text-white" onClick={onCreate}>Create</button>
        </div>
      </div>
    </div>
  );
}