// client/src/workspaces/k8s/K8sWorkspace.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listConnections, connectConnection, disconnectConnection, op } from '../../lib/api';
import { RefreshCw, Play, Square } from 'lucide-react';
import ConnectionBadge from '../../ui/ConnectionBadge.jsx';

export default function K8sWorkspace() {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [contexts, setContexts] = useState([]);
  const [current, setCurrent] = useState('');
  const [namespaces, setNamespaces] = useState([]);
  const [namespace, setNamespace] = useState('default');
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logId, setLogId] = useState(null);
  const [execId, setExecId] = useState(null);
  const [execCmd, setExecCmd] = useState('/bin/sh');

  const k8sConnections = useMemo(() => (connections || []).filter(c => c.type === 'k8s'), [connections]);

  useEffect(() => {
    (async () => {
      const res = await listConnections();
      setConnections(res.connections || []);
      const first = (res.connections || []).find(c => c.type === 'k8s');
      if (first) setSelectedId(first.id);
    })();
  }, []);

  async function onConnect() {
    if (!selectedId) return;
    setLoading(true);
    try {
      await connectConnection(selectedId);
      setStatus('connected');
      await refreshContexts();
      await refreshNamespaces();
    } finally { setLoading(false); }
  }

  async function onDisconnect() {
    if (!selectedId) return;
    setLoading(true);
    try {
      await disconnectConnection(selectedId);
      setStatus('disconnected');
      setContexts([]); setNamespaces([]);
    } finally { setLoading(false); }
  }

  async function refreshContexts() {
    const res = await op(selectedId, 'contexts', {});
    const data = res?.data || res; // handler returns {success:true,data:{contexts,current}}
    const ctxs = (data.contexts || []).map(c => c.name || c?.name);
    setContexts(ctxs);
    setCurrent(data.current || '');
  }

  async function useContext(name) {
    await op(selectedId, 'useContext', { name });
    await refreshContexts();
    await refreshNamespaces();
  }

  async function refreshNamespaces() {
    const res = await op(selectedId, 'namespaces', {});
    const data = res?.data || res;
    setNamespaces(data.namespaces || []);
    if (data.namespaces?.length && !data.namespaces.includes(namespace)) setNamespace(data.namespaces[0]);
  }

  async function refreshPods() {
    const res = await op(selectedId, 'pods', { namespace });
    const data = res?.data || res;
    setPods(data.pods || []);
  }

  // WS: receive logs/exec events
  useEffect(() => {
    const ws = new WebSocket(location.origin.replace('http', 'ws'));
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === 'k8s' && msg?.data?.event === 'logLine' && msg.data.connectionId === selectedId) {
          if (!logId || msg.data.id === logId) {
            setLogs(prev => [...prev, msg.data.line].slice(-1000));
          }
        }
      } catch (_) {}
    };
    return () => { try { ws.close(); } catch(_){} };
  }, [selectedId, logId]);

  async function startLogs(pod, container) {
    const res = await op(selectedId, 'logsStart', { namespace, pod, container, tailLines: 200 });
    const id = res?.data?.id || res?.id;
    setLogId(id);
    setLogs([]);
  }
  async function stopLogs() {
    if (!logId) return;
    await op(selectedId, 'logsStop', { id: logId });
    setLogId(null);
  }

  async function openExec(pod, container) {
    const command = execCmd.trim().split(/\s+/);
    const res = await op(selectedId, 'execOpen', { namespace, pod, container, command, tty: true });
    const id = res?.data?.id || res?.id;
    setExecId(id);
  }
  async function sendExec(data) {
    if (!execId) return;
    await op(selectedId, 'execInput', { id: execId, data });
  }
  async function closeExec() {
    if (!execId) return;
    await op(selectedId, 'execClose', { id: execId });
    setExecId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <ConnectionHeader connections={connections} selectedId={selectedId} status={status} />
        <div>
          <label className="block text-sm text-gray-600">Kubernetes Connection</label>
          <select className="border rounded px-3 py-2 min-w-[16rem]" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {k8sConnections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.config?.context || c.config?.kubeconfigPath || c.config?.kubeconfigSource})</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={onConnect} disabled={!selectedId || loading || status==='connected'} className="inline-flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-50">
            {loading ? <RefreshCw size={14} className="animate-spin"/> : <Play size={14}/>} Connect
          </button>
          <button onClick={onDisconnect} disabled={!selectedId || loading || status!=='connected'} className="inline-flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-50">
            <Square size={14}/> Disconnect
          </button>
          <button onClick={refreshContexts} disabled={status!=='connected'} className="inline-flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-50">
            <RefreshCw size={14}/> Contexts
          </button>
          <button onClick={refreshNamespaces} disabled={status!=='connected'} className="inline-flex items-center gap-1 px-3 py-2 border rounded hover:bg-gray-50">
            <RefreshCw size={14}/> Namespaces
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Contexts {current ? <span className="text-xs text-gray-500">(current: {current})</span> : null}</div>
          <div className="space-y-1">
            {contexts.map(name => (
              <div key={name} className="flex items-center justify-between py-1 border-b last:border-b-0">
                <div className="font-mono text-sm">{name}</div>
                <button className="px-2 py-1 text-xs border rounded" disabled={name===current} onClick={() => useContext(name)}>Use</button>
              </div>
            ))}
            {contexts.length === 0 && <div className="text-sm text-gray-500">No contexts</div>}
          </div>
        </div>
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Namespaces</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <select className="border rounded px-2 py-1" value={namespace} onChange={e=>setNamespace(e.target.value)}>
                {namespaces.map(ns => (<option key={ns} value={ns}>{ns}</option>))}
              </select>
              <button className="px-2 py-1 border rounded" onClick={refreshPods}>Load Pods</button>
            </div>
            {namespaces.length === 0 && <div className="text-sm text-gray-500">No namespaces</div>}
          </div>
        </div>
        <div className="border rounded p-3">
          <div className="font-medium mb-2">Pods in {namespace}</div>
          <div className="max-h-56 overflow-auto text-sm">
            {pods.map(p => (
              <div key={p.name} className="border-b py-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{p.name}</span>
                  <span className="text-xs text-gray-600">{p.phase}</span>
                </div>
                <div className="flex gap-2 mt-1">
                  <button className="px-2 py-1 border rounded text-xs" onClick={()=>startLogs(p.name)}>Logs</button>
                  <input className="px-2 py-1 border rounded text-xs flex-1" value={execCmd} onChange={e=>setExecCmd(e.target.value)} />
                  <button className="px-2 py-1 border rounded text-xs" onClick={()=>openExec(p.name)}>Exec</button>
                </div>
              </div>
            ))}
            {pods.length === 0 && <div className="text-gray-500">No pods</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Logs {logId ? <span className="text-xs text-gray-500">(stream {logId.slice(0,6)})</span> : null}</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 border rounded text-xs" disabled={!logId} onClick={stopLogs}>Stop</button>
              <button className="px-2 py-1 border rounded text-xs" onClick={()=>setLogs([])}>Clear</button>
            </div>
          </div>
          <pre className="bg-black text-green-400 text-xs p-2 rounded max-h-64 overflow-auto">{logs.join('')}</pre>
        </div>
        <div className="border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Exec {execId ? <span className="text-xs text-gray-500">(session {execId.slice(0,6)})</span> : null}</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 border rounded text-xs" disabled={!execId} onClick={closeExec}>Close</button>
            </div>
          </div>
          <textarea className="w-full h-24 border rounded p-2 font-mono text-xs" placeholder="Type and Ctrl+Enter to send"
                    onKeyDown={(e)=>{ if ((e.ctrlKey||e.metaKey) && e.key==='Enter') { sendExec(e.currentTarget.value + '\n'); e.currentTarget.value=''; } }} />
          <div className="text-xs text-gray-500 mt-1">Use Ctrl+Enter to send input to the container.</div>
        </div>
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
