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
  const [loading, setLoading] = React.useState(false);

  const list = React.useCallback(async (dir) => {
    if (!conn || conn.status !== 'connected') return;
    const path = dir ?? cwd;
    setLoading(true);
    try {
      const res = await op(conn.id, 'list', { path });
      if (res?.success) { setItems(res.data || []); setCwd(path); setSel(new Set()); }
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
      const next = new Set(sel); if (next.has(entry.name)) next.delete(entry.name); else next.add(entry.name); setSel(next);
    }
  };

  return { conn, setConn, cwd, setCwd, items, sel, setSel, list, goUp, open, loading };
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
  const [all, setAll] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ totalFiles: 0, doneFiles: 0, totalBytes: 0, doneBytes: 0, running: false, phase: '' });

  const reloadConns = async () => {
    const d = await listConnections();
    const list = (d.connections || []).filter(c => ['localfs','ftp','sftp'].includes(c.type));
    setAll(list);
  };
  React.useEffect(() => { reloadConns(); }, []);

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

  const copy = async (src, dst) => {
    if (!src.conn || !dst.conn) return;
    const names = Array.from(src.sel);
    if (!names.length) return;
    setBusy(true);
    try {
      // Build copy plan (recurses into folders)
      setProgress({ totalFiles: 0, doneFiles: 0, totalBytes: 0, doneBytes: 0, running: true, phase: 'Scanning…' });
      const { files, totalBytes } = await buildPlan(src, dst, names);
      setProgress({ totalFiles: files.length, doneFiles: 0, totalBytes, doneBytes: 0, running: true, phase: 'Copying…' });

      for (let i=0;i<files.length;i++){
        const f = files[i];
        const dstPath = join(dst.cwd, f.rel);
        await ensureDir(dst, parentDir(f.rel));
        const dl = await op(src.conn.id, 'download', { path: f.srcPath });
        if (!dl?.success) throw new Error(dl?.error || 'download failed');
        await op(dst.conn.id, 'upload', { path: dstPath, base64: dl.data?.base64 });
        setProgress(prev => ({ ...prev, doneFiles: i+1, doneBytes: Math.min(prev.totalBytes, prev.doneBytes + (f.size||0)) }));
      }

      await dst.list(dst.cwd);
      setProgress(prev => ({ ...prev, running: false, phase: 'Done' }));
    } catch (e) { setProgress(prev=>({ ...prev, running:false, phase: 'Error' })); alert(e.message || 'copy failed'); }
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

  const Pane = ({ pane, side, onDropFromOther }) => (
    <div className="flex-1 flex flex-col border rounded">
      <div className="flex items-center gap-2 p-2 border-b">
        <Button variant="secondary" onClick={pane.goUp}>Up</Button>
        <Button variant="secondary" onClick={()=>pane.list(pane.cwd)}>Refresh</Button>
        <Input className="flex-1" value={pane.cwd} onChange={e=>pane.setCwd(e.target.value)} />
        <Button onClick={()=>pane.list(pane.cwd)} disabled={!pane.conn || pane.conn.status!=='connected'}>Go</Button>
      </div>
      <div className="flex-1 overflow-auto" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{
        try {
          const s = e.dataTransfer.getData('application/x-unicon');
          if (!s) return;
          const payload = JSON.parse(s);
          if (payload.from && payload.from !== side && Array.isArray(payload.names) && payload.names.length){ onDropFromOther(payload.names, payload.from); }
        } catch(_){}
      }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-2 py-1 w-6"></th><th className="text-left px-2 py-1">Name</th><th className="text-left px-2 py-1">Type</th><th className="text-left px-2 py-1">Size</th></tr></thead>
          <tbody>
            {pane.items.map((it,i)=>{
              const isDir = it.isDirectory===true || it.type==='d' || it.type===1; const checked = pane.sel.has(it.name);
              return (
                <tr key={i} className={`border-b ${checked?'bg-blue-50':''}`} draggable onDragStart={(e)=>{
                  const names = pane.sel.has(it.name) ? Array.from(pane.sel) : [it.name];
                  e.dataTransfer.setData('application/x-unicon', JSON.stringify({ from: side, names }));
                }}>
                  <td className="px-2 py-1">{!isDir && (<input type="checkbox" checked={checked} onChange={()=>{ const s=new Set(pane.sel); if(s.has(it.name)) s.delete(it.name); else s.add(it.name); pane.setSel(s); }} />)}</td>
                  <td className="px-2 py-1"><button className="hover:underline" onClick={()=>pane.open(it)}>{it.name}</button></td>
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
        <ConnPicker pane={left} />
        <div className="flex items-center gap-3">
          <Button onClick={()=>copy(right, left)} disabled={busy || !right.sel.size}>← Copy</Button>
          <Button onClick={()=>copy(left, right)} disabled={busy || !left.sel.size}>Copy →</Button>
          {progress.running && (
            <div className="min-w-[240px] text-xs text-gray-700">
              <div className="w-full h-2 bg-gray-200 rounded overflow-hidden mb-1">
                <div className="h-2 bg-blue-600" style={{ width: `${progress.totalBytes>0 ? Math.floor(100*(progress.doneBytes/progress.totalBytes)) : Math.floor(100*(progress.doneFiles/Math.max(1,progress.totalFiles)))}%` }} />
              </div>
              <div>{progress.phase} {progress.doneFiles}/{progress.totalFiles} files · {Math.round(progress.doneBytes/1024)} / {Math.round(progress.totalBytes/1024)} KB</div>
            </div>
          )}
        </div>
        <ConnPicker pane={right} />
      </div>

      <div className="flex gap-3 min-h-[400px]">
        <Pane side="left" pane={left} onDropFromOther={(names)=>copy(right,left)} />
        <Pane side="right" pane={right} onDropFromOther={(names)=>copy(left,right)} />
      </div>
    </div>
  );
}
