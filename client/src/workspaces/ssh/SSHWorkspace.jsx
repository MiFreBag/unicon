// client/src/workspaces/ssh/SSHWorkspace.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listConnections, connectConnection, disconnectConnection, op } from '../../lib/api';
import { Play, Square, Terminal, RefreshCw } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import ConnectionBadge from '../../ui/ConnectionBadge.jsx';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

function makeWSUrl() {
  const envUrl = import.meta?.env?.VITE_WS_URL;
  const port = import.meta?.env?.VITE_WS_PORT || 8080;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const sameOrigin = `${proto}://${location.host}/ws`;
  const fallback = `ws://localhost:${port}`;
  // Prefer same-origin so Vite can proxy wss->ws in dev; allow override via VITE_WS_URL
  return envUrl || sameOrigin;
}

import { createConnection } from '../../lib/api';

export default function SSHWorkspace({ connectionId: initialConnectionId, openTab }) {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const termRef = useRef(null);
  const xtermRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);

  const sshConnections = useMemo(() => (connections || []).filter(c => c.type === 'ssh'), [connections]);

  useEffect(() => {
    (async () => {
      const res = await listConnections();
      setConnections(res.connections || []);
      const list = (res.connections || []).filter(c => c.type === 'ssh');
      const preferred = list.find(c => c.id === initialConnectionId);
      const first = preferred || list[0];
      if (first) setSelectedId(first.id);
    })();
  }, [initialConnectionId]);

  // Setup WebSocket to receive shell data
  useEffect(() => {
    const ws = new WebSocket(makeWSUrl());
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === 'ssh' && msg?.data?.event === 'shellData') {
          if (msg.data.sessionId === sessionId) {
            xtermRef.current?.write(msg.data.data);
          }
        }
      } catch (_) {}
    };
    wsRef.current = ws;
    return () => { try { ws.close(); } catch (_) {} };
  }, [sessionId]);

// Create terminal instance (defer until container is attached)
useEffect(() => {
  let disposed = false;
  function init() {
    if (disposed) return;
    const el = termRef.current;
    if (!el || !el.isConnected) { requestAnimationFrame(init); return; }
    try {
      const xterm = new XTerm({
        rendererType: 'canvas',
        fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
        fontSize: 13,
        convertEol: true,
        cursorBlink: true,
        theme: { background: '#ffffff', foreground: '#111827' }
      });
      const fit = new FitAddon();
      xterm.loadAddon(fit);
      xterm.open(el);
      // Double-rAF to allow renderer to settle
      requestAnimationFrame(() => requestAnimationFrame(() => { try { fit.fit(); } catch {} }));
      xtermRef.current = xterm;
      fitRef.current = fit;

      const onResize = () => { requestAnimationFrame(() => { try { fit.fit(); } catch {} }); };
      window.addEventListener('resize', onResize);

      // Send typed data to server when a session is active
      xterm.onData(async (data) => {
        if (!sessionId) return;
        try { await op(selectedId, 'shellInput', { sessionId, data }); } catch {}
      });

      // Cleanup
      return () => {
        window.removeEventListener('resize', onResize);
        try { xterm.dispose(); } catch {}
      };
    } catch (e) {
      // Retry once if renderer not ready yet
      setTimeout(init, 16);
    }
  }
  const cleanup = init();
  return () => { disposed = true; if (typeof cleanup === 'function') cleanup(); };
}, []);

  async function onConnect() {
    if (!selectedId) return;
    setLoading(true);
    try {
      await connectConnection(selectedId);
      setStatus('connected');
      // open shell
      const cols = xtermRef.current?.cols || 80;
      const rows = xtermRef.current?.rows || 24;
      const r = await op(selectedId, 'shellOpen', { cols, rows });
      const sid = r?.data?.sessionId;
      setSessionId(sid);
      // greet
      xtermRef.current?.write('\r\n');
    } catch (e) {
      xtermRef.current?.writeln(`\r\nError: ${e.message}`);
    } finally { setLoading(false); }
  }

  async function onDisconnect() {
    if (!selectedId) return;
    setLoading(true);
    try {
      if (sessionId) { await op(selectedId, 'shellClose', { sessionId }); setSessionId(null); }
      await disconnectConnection(selectedId);
      setStatus('disconnected');
    } finally { setLoading(false); }
  }

  // When terminal resizes, notify server
  useEffect(() => {
    const id = setInterval(() => {
      if (!sessionId) return;
      const cols = xtermRef.current?.cols;
      const rows = xtermRef.current?.rows;
      if (cols && rows) { op(selectedId, 'shellResize', { sessionId, cols, rows }).catch(() => {}); }
    }, 1500);
    return () => clearInterval(id);
  }, [sessionId, selectedId]);

  // ---- SFTP helpers ----
  const [sftpPath, setSftpPath] = useState('.');
  const [entries, setEntries] = useState([]);

  async function listSftp() {
    if (!selectedId || status !== 'connected') return;
    try {
      const res = await op(selectedId, 'sftpList', { path: sftpPath });
      const list = res?.data?.entries || res?.entries || [];
      setEntries(list);
    } catch (e) {
      console.error(e);
    }
  }

  async function downloadFile(name) {
    try {
      const p = sftpPath.endsWith('/') ? `${sftpPath}${name}` : `${sftpPath}/${name}`;
      const res = await op(selectedId, 'sftpGet', { path: p });
      const b64 = res?.data?.base64 || res?.base64;
      if (!b64) return;
      const blob = b64toBlob(b64);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  }

  function b64toBlob(b64) {
    const byteChars = atob(b64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNums);
    return new Blob([byteArray]);
  }

  async function uploadFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const p = sftpPath.endsWith('/') ? `${sftpPath}${file.name}` : `${sftpPath}/${file.name}`;
    await op(selectedId, 'sftpPut', { path: p, base64 });
    await listSftp();
  }

  async function quickCreate(kind) {
    if (!kind) return;
    if (kind === 'ssh_local') {
      const res = await createConnection({ name: 'SSH localhost', type: 'ssh', config: { host: 'localhost', port: 22, username: 'user' } });
      const conn = res.connection; setSelectedId(conn.id);
      if (typeof openTab === 'function') openTab('ssh', { connectionId: conn.id, connection: conn, title: `SSH • ${conn.name}` });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <div className="text-sm text-gray-700">
          Quick pick:
          <select className="ml-2 border rounded px-2 py-1" onChange={(e)=>{ const v=e.target.value; e.target.value=''; quickCreate(v); }}>
            <option>Pick…</option>
            <option value="ssh_local">SSH localhost (22)</option>
          </select>
        </div>
        <ConnectionHeader connections={connections} selectedId={selectedId} status={status} />
        <div>
          <label className="block text-sm text-gray-600">SSH Connection</label>
          <select className="border rounded px-3 py-2 min-w-[16rem]" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {sshConnections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.config?.host})</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onConnect} disabled={!selectedId || loading || status==='connected'} className="inline-flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-50">
            {loading ? <RefreshCw size={14} className="animate-spin"/> : <Play size={14}/>} Connect
          </button>
          <button onClick={onDisconnect} disabled={!selectedId || loading || status!=='connected'} className="inline-flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-50">
            <Square size={14}/> Disconnect
          </button>
        </div>
      </div>

      <div className="border rounded h-[360px] overflow-hidden">
        <div ref={termRef} className="h-full" aria-label="SSH Terminal" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded p-3">
          <div className="flex items-end gap-2 mb-2">
            <div className="flex-1">
              <label className="block text-sm text-gray-600">SFTP Path</label>
              <input className="w-full border rounded px-2 py-1" value={sftpPath} onChange={e => setSftpPath(e.target.value)} />
            </div>
            <button className="px-3 py-1.5 border rounded" disabled={status!=='connected'} onClick={listSftp}>List</button>
            <label className="px-3 py-1.5 border rounded cursor-pointer">
              Upload
              <input type="file" className="hidden" onChange={e => e.target.files && e.target.files[0] && uploadFile(e.target.files[0])} />
            </label>
          </div>
          <div className="max-h-48 overflow-auto text-sm">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center justify-between border-b py-1">
                <span className="font-mono">{e.filename}</span>
                <button className="px-2 py-0.5 text-xs border rounded" onClick={() => downloadFile(e.filename)}>Download</button>
              </div>
            ))}
            {entries.length === 0 && <div className="text-gray-500">No entries</div>}
          </div>
        </div>
        <div className="text-xs text-gray-500 flex items-center">Status: {status}{sessionId ? ` • session ${sessionId.slice(0,8)}` : ''}</div>
      </div>
    </div>
  );
}

function ConnectionHeader({ connections, selectedId, status }) {
  const sel = (connections || []).find(c => c.id === selectedId) || null;
  return (
    <div className="ml-auto">
      <ConnectionBadge connection={sel || undefined} status={status} />
    </div>
  );
}
