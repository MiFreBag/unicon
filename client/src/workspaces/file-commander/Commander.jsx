// client/src/workspaces/file-commander/Commander.jsx
import React from 'react';
import { listConnections, connectConnection, disconnectConnection, op } from '../../lib/api';
import Button from '../../ui/Button.jsx';
import Input from '../../ui/Input.jsx';
import Select from '../../ui/Select.jsx';

function usePane() {
  const [conn, setConn] = React.useState(null);
  const [cwd, setCwd] = React.useState('.');
  const [items, setItems] = React.useState([]);
  const [sel, setSel] = React.useState(new Set());
  const [lastIndex, setLastIndex] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);

  const list = React.useCallback(async (dir) => {
    if (!conn || conn.status !== 'connected') return;
    const path = dir ?? cwd;
    setLoading(true);
    try {
      const res = await op(conn.id, 'list', { path });
      if (res?.success) { setItems(res.data || []); setCwd(path); setSel(new Set()); setLastIndex(-1); }
    } finally { setLoading(false); }
  }, [conn, cwd]);

  const goUp = () => {
    if (!cwd || cwd === '.' || cwd === '/') { list('/'); return; }
    const parts = String(cwd).replace(/\\+/g,'/').split('/'); parts.pop();
    list(parts.join('/') || '/');
  };

  const open = (entry) => {
    const isDir = entry.isDirectory === true || entry.type === 'd' || entry.type === 1;
    if (isDir) {
      const next = (cwd === '/' ? `/${entry.name}` : `${cwd}/${entry.name}`);
      list(next);
    } else {
      // default single select
      const next = new Set([entry.name]);
      setSel(next);
    }
  };

  function onRowClick(e, entry, index){
    const isDir = entry.isDirectory === true || entry.type === 'd' || entry.type === 1;
    if (isDir) return; // rows for files only affect selection; folder open via name click
    const ctrl = e.ctrlKey || e.metaKey; const shift = e.shiftKey;
    if (shift && lastIndex !== -1) {
      const a = Math.min(lastIndex, index); const b = Math.max(lastIndex, index);
      const names = items.slice(a, b+1).filter(x=>!(x.isDirectory===true || x.type==='d' || x.type===1)).map(x=>x.name);
      setSel(new Set(names));
    } else if (ctrl) {
      const next = new Set(sel); if (next.has(entry.name)) next.delete(entry.name); else next.add(entry.name); setSel(next); setLastIndex(index);
    } else {
      setSel(new Set([entry.name])); setLastIndex(index);
    }
  }

  return { conn, setConn, cwd, setCwd, items, sel, setSel, lastIndex, setLastIndex, list, goUp, open, loading, onRowClick };
}

async function copyOne({ src, dst, name }) {
  const srcPath = (src.cwd === '/' ? `/${name}` : `${src.cwd}/${name}`);
  const dstPath = (dst.cwd === '/' ? `/${name}` : `${dst.cwd}/${name}`);
  const dl = await op(src.conn.id, 'download', { path: srcPath });
  if (!dl?.success) throw new Error(dl?.error || 'download failed');
  const up = await op(dst.conn.id, 'upload', { path: dstPath, base64: dl.data?.base64 });
  if (!up?.success) throw new Error(up?.error || 'upload failed');
}

export default function Commander() {
  const left = usePane();
  const right = usePane();

  // Native (browser) local left pane
  const localLeft = useLocalPane();
  const [useLocalLeft, setUseLocalLeft] = React.useState(false);
  const [all, setAll] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ totalFiles: 0, doneFiles: 0, totalBytes: 0, doneBytes: 0, running: false, phase: '' });
  const [queue, setQueue] = React.useState([]); // tasks: {jobId,srcConnId,dstConnId,srcPath,dstPath,size}
  const [paused, setPaused] = React.useState(false);
  const processingRef = React.useRef(false);
  const [inflight, setInflight] = React.useState({ jobId: null, bytes: 0, total: 0 });

  const reloadConns = async () => {
    const d = await listConnections();
    const list = (d.connections || []).filter(c => ['localfs','ftp','sftp'].includes(c.type));
    setAll(list);
  };
  React.useEffect(() => { reloadConns(); }, []);

  // WS progress listener
  React.useEffect(() => {
    const onWs = (e) => {
      const m = e.detail || {};
      if (m.type !== 'transfer') return;
      const d = m.data || {};
      setInflight(prev => (prev.jobId && d.jobId === prev.jobId) ? { jobId: prev.jobId, bytes: d.bytes || 0, total: d.total || prev.total } : prev);
    };
    window.addEventListener('unicon-ws', onWs);
    return () => window.removeEventListener('unicon-ws', onWs);
  }, []);

  const ensureConnected = async (pane) => {
    if (!pane.conn) return;
    if (pane.conn.status !== 'connected') {
      await connectConnection(pane.conn.id);
      pane.setConn({ ...pane.conn, status: 'connected' });
    }
    await pane.list('.');
  };

  function norm(pathStr) { return String(pathStr || '').replace(/\\+/g,'/').replace(/\/+/, '/'); }
  function join(a,b){ if(!a||a==='.') return b||''; if(a.endsWith('/')) return b?`${a}${b}`:a; return b?`${a}/${b}`:a; }
  function parentDir(p){ const n = norm(p); const parts = n.split('/'); parts.pop(); return parts.join('/') || '/'; }
  async function ensureDir(pane, dirPath){ // create nested dirs, ignore errors
    const n = norm(dirPath);
    if (!n || n === '.' || n === '/') return;
    const parts = n.split('/');
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      try { await op(pane.conn.id, 'mkdir', { path: acc }); } catch(_) { /* ignore */ }
    }
  }

  async function buildPlan(src, dst, names){
    const files = [];
    let totalBytes = 0;
    const base = norm(src.cwd);
    const byName = new Map((src.items||[]).map(it=>[it.name,it]));
    async function walk(absPath, relRoot){
      const res = await op(src.conn.id, 'list', { path: absPath });
      const entries = res?.data || [];
      for (const e of entries){
        const absChild = join(absPath, e.name);
        const relChild = join(relRoot, e.name);
        const isDir = e.isDirectory===true || e.type==='d' || e.type===1;
        if (isDir){ await walk(absChild, relChild); }
        else { const size = Number(e.size||0); totalBytes += size; files.push({ srcPath: absChild, rel: relChild, size }); }
      }
    }
    for (const name of names){
      const entry = byName.get(name);
      const abs = join(base, name);
      const isDir = entry && (entry.isDirectory===true || entry.type==='d' || entry.type===1);
      if (isDir) { await walk(abs, name); }
      else { const size = Number(entry?.size||0); totalBytes += size; files.push({ srcPath: abs, rel: name, size }); }
    }
    return { files, totalBytes };
  }

  async function enqueueCopy(src, dst, names){
    // Build plan and push to queue
    setProgress(p=>({ ...p, running: true, phase: p.running ? p.phase : 'Queued', totalFiles: p.totalFiles, totalBytes: p.totalBytes }));
    const { files, totalBytes } = await buildPlan(src, dst, names);
    const tasks = files.map(f => ({ jobId: `${Date.now()}-${Math.random().toString(36).slice(2)}`, srcConnId: src.conn.id, dstConnId: dst.conn.id, srcPath: f.srcPath, dstPath: join(dst.cwd, f.rel), size: f.size }));
    setQueue(prev => [...prev, ...tasks]);
    setProgress(prev => ({ ...prev, totalFiles: prev.totalFiles + tasks.length, totalBytes: prev.totalBytes + totalBytes }));
    if (!processingRef.current && !paused) processQueue();
  }

  async function processQueue(){
    processingRef.current = true;
    setProgress(prev => ({ ...prev, running: true, phase: 'Copying…' }));
    while (!paused) {
      let task = null;
      setQueue(prev => {
        if (!prev.length) return prev; task = prev[0]; return prev.slice(1);
      });
      if (!task) break;
      try {
        // Ensure parent dir exists on dst (best-effort)
        await ensureDir({ conn: { id: task.dstConnId } }, parentDir(task.dstPath.replace(/^\/+/, '')));
        setInflight({ jobId: task.jobId, bytes: 0, total: task.size || 0 });
        await fetch('/unicon/api/transfer/copy', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ jobId: task.jobId, src: { connectionId: task.srcConnId, path: task.srcPath }, dst: { connectionId: task.dstConnId, path: task.dstPath }, size: task.size||null }) }).then(r=>r.json()).then(d=>{ if (!d?.success) throw new Error(d?.error||'copy error'); });
        setProgress(prev => ({ ...prev, doneFiles: prev.doneFiles + 1, doneBytes: Math.min(prev.totalBytes, prev.doneBytes + (task.size||0)) }));
      } catch (e) {
        alert(`Copy failed: ${e.message || e}`);
      } finally {
        setInflight({ jobId: null, bytes: 0, total: 0 });
      }
    }
    processingRef.current = false;
    setProgress(prev => ({ ...prev, phase: paused ? 'Paused' : (queue.length ? 'Queued' : 'Done'), running: queue.length>0 || paused }));
  }

  const copy = async (src, dst) => {
    if (!src.conn || !dst.conn) return;
    const names = Array.from(src.sel);
    if (!names.length) return;
    setBusy(true);
    try {
      await enqueueCopy(src, dst, names);
    } catch (e) { alert(e.message || 'enqueue failed'); }
    finally { setBusy(false); }
  };

  const ConnPicker = ({ pane }) => (
    <div className="flex items-center gap-2">
      <Select value={pane.conn?.id || ''} onChange={(e)=>{
        const id = e.target.value; const c = all.find(x=>x.id===id) || null; pane.setConn(c); if (c?.status==='connected') pane.list('.');
      }}>
        <option value="">Pick connection…</option>
        {all.map(c => (<option key={c.id} value={c.id}>{c.type.toUpperCase()} • {c.name}</option>))}
      </Select>
      <Button variant="secondary" onClick={()=>ensureConnected(pane)} disabled={!pane.conn || pane.conn.status==='connected'}>Connect</Button>
      <Button variant="secondary" onClick={async()=>{ if(!pane.conn) return; await disconnectConnection(pane.conn.id); pane.setConn({ ...pane.conn, status:'disconnected' }); }} disabled={!pane.conn || pane.conn.status!=='connected'}>Disconnect</Button>
    </div>
  );

  const Pane = ({ pane, side, onDropFromOther, onDropLocal }) => (
    <div className="flex-1 flex flex-col border rounded">
      <div className="flex items-center gap-2 p-2 border-b">
        <Button variant="secondary" onClick={pane.goUp}>Up</Button>
        <Button variant="secondary" onClick={()=>pane.list(pane.cwd)}>Refresh</Button>
        <Input className="flex-1" value={pane.cwd} onChange={e=>pane.setCwd(e.target.value)} />
        <input type="file" multiple onChange={async (e)=>{
          if (!pane.conn || pane.conn.status!=='connected') return;
          const files = Array.from(e.target.files||[]);
          for (const f of files) { const fd = new FormData(); fd.append('connectionId', pane.conn.id); fd.append('cwd', pane.cwd||'.'); fd.append('file', f, f.name); await fetch('/unicon/api/stream/upload', { method:'POST', body: fd }); }
          try { await pane.list(pane.cwd); } catch(_){ }
          e.target.value='';
        }} />
        <Button onClick={()=>pane.list(pane.cwd)} disabled={!pane.conn || pane.conn.status!=='connected'}>Go</Button>
        <Button variant="secondary" onClick={()=>{
          if (!pane.conn || pane.conn.status!=='connected') return; const names = Array.from(pane.sel); if (!names.length) return;
          for (const n of names) { const p = (pane.cwd==='/'?`/${n}`:`${pane.cwd}/${n}`); const url = `/unicon/api/stream/download?connectionId=${encodeURIComponent(pane.conn.id)}&path=${encodeURIComponent(p)}`; const a=document.createElement('a'); a.href=url; a.download=''; a.target='_blank'; document.body.appendChild(a); a.click(); a.remove(); }
        }} disabled={!pane.sel.size}>Download</Button>
      </div>
      <div className="flex-1 overflow-auto" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
        try {
          const sLocal = e.dataTransfer.getData('application/x-unicon-local');
          if (sLocal) {
            const payload = JSON.parse(sLocal);
            if (Array.isArray(payload.relPaths) && payload.relPaths.length) { onDropLocal && onDropLocal(payload.relPaths); return; }
          }
          const s = e.dataTransfer.getData('application/x-unicon');
          if (s) {
            const payload = JSON.parse(s);
            if (payload.from && payload.from !== side && Array.isArray(payload.names) && payload.names.length){ onDropFromOther(payload.names, payload.from); return; }
          }
        } catch(_){}}
      }>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-2 py-1 w-6"></th><th className="text-left px-2 py-1">Name</th><th className="text-left px-2 py-1">Type</th><th className="text-left px-2 py-1">Size</th></tr></thead>
          <tbody>
            {pane.items.map((it,i)=>{
              const isDir = it.isDirectory===true || it.type==='d' || it.type===1; const checked = pane.sel.has(it.name);
              return (
                <tr key={i} className={`border-b ${checked?'bg-blue-50':''}`} draggable onDragStart={(e)=>{
                  const names = pane.sel.has(it.name) ? Array.from(pane.sel) : [it.name];
                  e.dataTransfer.setData('application/x-unicon', JSON.stringify({ from: side, names }));
                }} onClick={(e)=>pane.onRowClick(e, it, i)}>
                  <td className="px-2 py-1">{!isDir && (<input type="checkbox" checked={checked} onChange={(e)=>{ e.stopPropagation(); const s=new Set(pane.sel); if(s.has(it.name)) s.delete(it.name); else s.add(it.name); pane.setSel(s); }} />)}</td>
                  <td className="px-2 py-1"><button className="hover:underline" onClick={(e)=>{ e.stopPropagation(); pane.open(it); }}>{it.name}</button></td>
                  <td className="px-2 py-1">{isDir? 'dir':'file'}</td>
                  <td className="px-2 py-1">{it.size ?? ''}</td>
                </tr>
              );
            })}
            {!pane.items.length && (<tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>{pane.loading ? 'Loading…' : 'Empty'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><b>File Commander</b></div>
        <Button variant="secondary" onClick={reloadConns}>Reload connections</Button>
      </div>

      <div className="flex items-center gap-6">
        {useLocalLeft ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={async()=>{ const ok = await localLeft.pickRoot(); if (ok) await localLeft.list('.'); }}>Pick folder…</Button>
            <div className="text-sm text-gray-600">{localLeft.rootName || 'No folder selected'}</div>
            <Button variant="secondary" onClick={()=>localLeft.goUp()} disabled={!localLeft.canGoUp}>Up</Button>
          </div>
        ) : (
          <ConnPicker pane={left} />
        )}
        <div className="flex items-center gap-3">
          <Button onClick={()=>copy(right, left)} disabled={busy || !right.sel.size}>← Copy</Button>
          <Button onClick={()=>copy(left, right)} disabled={busy || !left.sel.size}>Copy →</Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={()=>{ setPaused(true); setProgress(p=>({ ...p, phase:'Paused', running:true })); }} disabled={paused || (!progress.running && !queue.length)}>Pause</Button>
            <Button variant="secondary" onClick={()=>{ setPaused(false); if (!processingRef.current) processQueue(); }} disabled={!paused}>Resume</Button>
            <Button variant="secondary" onClick={()=>{ setQueue([]); setProgress(p=>({ ...p, running:false, phase:'Canceled' })); }} disabled={!queue.length && !progress.running}>Cancel</Button>
          </div>
          <div className="min-w-[300px] text-xs text-gray-700">
            <div className="w-full h-2 bg-gray-200 rounded overflow-hidden mb-1">
              <div className="h-2 bg-blue-600" style={{ width: `${progress.totalBytes>0 ? Math.floor(100*((progress.doneBytes + (inflight.bytes||0))/Math.max(1,progress.totalBytes))) : Math.floor(100*(progress.doneFiles/Math.max(1,progress.totalFiles)))}%` }} />
            </div>
            <div>{progress.phase || (queue.length ? 'Queued' : '')} {progress.doneFiles}/{progress.totalFiles} files · {Math.round((progress.doneBytes + (inflight.bytes||0))/1024)} / {Math.round(Math.max(1,progress.totalBytes)/1024)} KB · Queue: {queue.length}</div>
          </div>
        </div>
        <ConnPicker pane={right} />
        <Button variant="secondary" onClick={()=>setUseLocalLeft(v=>!v)}>{useLocalLeft ? 'Use connection on left' : 'Use Local (This computer) on left'}</Button>
      </div>

      <div className="flex gap-3 min-h-[400px]">
        {useLocalLeft ? (
          <LocalPane pane={localLeft} side="left" />
        ) : (
          <Pane side="left" pane={left} onDropFromOther={(names)=>enqueueCopy(right,left,names)} />
        )}
        <Pane side="right" pane={right} onDropFromOther={(names)=>enqueueCopy(left,right,names)} onDropLocal={async (relPaths)=>{ if (!right.conn||right.conn.status!=='connected') return; await localLeft.uploadTo(right, relPaths); await right.list(right.cwd); }} />
      </div>
    </div>
  );
}

// ---- Native Local Pane using File System Access API ----
function useLocalPane(){
  const [root, setRoot] = React.useState(null); // FileSystemDirectoryHandle
  const [stack, setStack] = React.useState([]); // path segments
  const [items, setItems] = React.useState([]);
  const [sel, setSel] = React.useState(new Set());
  const [loading, setLoading] = React.useState(false);

  const rootName = React.useMemo(()=> (root ? (root.name || 'Folder') : ''), [root]);
  const cwd = React.useMemo(()=> (stack.length ? stack.join('/') : '.'), [stack]);
  const canGoUp = stack.length > 0;

  async function pickRoot(){
    try { const dir = await window.showDirectoryPicker(); setRoot(dir); setStack([]); setSel(new Set()); return true; } catch { return false; }
  }

  async function getDirHandle(){
    if (!root) return null;
    let h = root; for (const seg of stack){ h = await h.getDirectoryHandle(seg); }
    return h;
  }

  async function list(dirRel = '.'){
    if (!root) return; setLoading(true);
    try {
      if (dirRel !== '.' && dirRel) {
        const parts = String(dirRel).split('/').filter(Boolean); setStack(parts);
      }
      const dir = await getDirHandle(); if (!dir) return;
      const next = [];
      for await (const [name, handle] of dir.entries()){
        if (handle.kind === 'directory') next.push({ name, isDirectory: true, type: 'd' });
        else { try { const file = await handle.getFile(); next.push({ name, isDirectory: false, type: 'f', size: file.size }); } catch { next.push({ name, isDirectory: false, type: 'f' }); }
        }
      }
      next.sort((a,b)=> (a.isDirectory===b.isDirectory) ? a.name.localeCompare(b.name) : (a.isDirectory ? -1 : 1));
      setItems(next); setSel(new Set());
    } finally { setLoading(false); }
  }

  function goUp(){ if (!canGoUp) return; const arr = stack.slice(0,-1); setStack(arr); list(arr.join('/')||'.'); }

  async function open(entry){ if (entry.isDirectory) { const next = [...stack, entry.name]; setStack(next); await list(next.join('/')); } else { const s = new Set([entry.name]); setSel(s); } }

  function onRowClick(e, entry, index){ const ctrl = e.ctrlKey || e.metaKey; const shift = e.shiftKey; if (entry.isDirectory) return; if (shift) { /* simple: ignore for now */ } if (ctrl) { const n=new Set(sel); if(n.has(entry.name)) n.delete(entry.name); else n.add(entry.name); setSel(n); } else { setSel(new Set([entry.name])); } }

  async function resolveFileHandle(rel){ let h = await getDirHandle(); const parts = String(rel).split('/').filter(Boolean); for (let i=0;i<parts.length;i++){ const seg=parts[i]; if (i === parts.length-1) { return h.getFileHandle(seg); } h = await h.getDirectoryHandle(seg); } }

  async function gatherFiles(rel){ // returns [{rel, file}]
    const out = [];
    async function walk(dirRel){
      const dir = await getDirHandle(); // base
      // navigate to dirRel
      let h = dir; if (dirRel && dirRel !== '.') { const segs = dirRel.split('/').filter(Boolean); for (const s of segs){ h = await h.getDirectoryHandle(s); } }
      for await (const [name, handle] of h.entries()){
        if (handle.kind === 'directory') await walk(dirRel && dirRel !== '.' ? `${dirRel}/${name}` : name);
        else { const file = await handle.getFile(); out.push({ rel: (dirRel && dirRel !== '.' ? `${dirRel}/${name}` : name), file }); }
      }
    }
    // rel may be file or directory
    try {
      const fh = await resolveFileHandle(rel).catch(()=>null);
      if (fh) { const file = await (await fh).getFile(); out.push({ rel, file }); }
      else { await walk(rel); }
    } catch {}
    return out;
  }

  async function uploadTo(dstPane, relPaths){
    for (const rel of relPaths){
      const files = await gatherFiles(rel);
      for (const { rel: r, file } of files){
        // ensure folder on dst
        const parent = r.split('/').slice(0,-1).join('/');
        if (parent) { try { await op(dstPane.conn.id, 'mkdir', { path: parent }); } catch(_){} }
        const fd = new FormData(); fd.append('connectionId', dstPane.conn.id); fd.append('cwd', parent ? parent : dstPane.cwd || '.'); fd.append('file', file, r.split('/').pop());
        await fetch('/unicon/api/stream/upload', { method:'POST', body: fd });
      }
    }
  }

  return { root, rootName, items, sel, setSel, loading, cwd, canGoUp, pickRoot, list, goUp, open, onRowClick, uploadTo };
}

function LocalPane({ pane, side }){
  return (
    <div className="flex-1 flex flex-col border rounded" onDragOver={(e)=>e.preventDefault()}>
      <div className="flex items-center gap-2 p-2 border-b">
        <Input className="flex-1" value={pane.cwd} readOnly />
        <Button variant="secondary" onClick={()=>pane.goUp()} disabled={!pane.canGoUp}>Up</Button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="w-6"></th><th className="text-left px-2 py-1">Name</th><th className="text-left px-2 py-1">Type</th><th className="text-left px-2 py-1">Size</th></tr></thead>
          <tbody>
            {pane.items.map((it,i)=>{
              const checked = pane.sel.has(it.name);
              return (
                <tr key={i} className={`border-b ${checked?'bg-blue-50':''}`} draggable={!it.isDirectory} onDragStart={(e)=>{
                  const names = pane.sel.has(it.name) ? Array.from(pane.sel) : [it.name];
                  e.dataTransfer.setData('application/x-unicon-local', JSON.stringify({ relPaths: names }));
                }} onClick={(e)=>pane.onRowClick(e, it, i)}>
                  <td className="px-2 py-1">{!it.isDirectory && (<input type="checkbox" checked={checked} onChange={(e)=>{ e.stopPropagation(); const s=new Set(pane.sel); if(s.has(it.name)) s.delete(it.name); else s.add(it.name); pane.setSel(s); }} />)}</td>
                  <td className="px-2 py-1"><button className="hover:underline" onClick={(e)=>{ e.stopPropagation(); pane.open(it); }}>{it.name}</button></td>
                  <td className="px-2 py-1">{it.isDirectory? 'dir':'file'}</td>
                  <td className="px-2 py-1">{it.size ?? ''}</td>
                </tr>
              );
            })}
            {!pane.items.length && (<tr><td className="px-3 py-6 text-center text-gray-500" colSpan={4}>{pane.loading ? 'Loading…' : 'Empty'}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
