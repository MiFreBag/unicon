// client/src/features/connections/ConnectionList.jsx
import React, { useEffect, useState } from 'react';
import { listConnections, createConnection, deleteConnection, connectConnection, disconnectConnection, updateConnection, op, listWorkspaces } from '../../lib/api';
import { Plus, Trash2, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react';
import Spinner from '../../ui/Spinner.jsx';
import Modal from '../../ui/Modal.jsx';
import { EXAMPLE_PRESETS } from '../examples/presets.js';
import { getLibrary, saveTemplate, serverAdd, serverList } from '../examples/library.js';

export default function ConnectionList({ openTab }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [autoOpen, setAutoOpen] = useState(() => { try { return localStorage.getItem('unicon_auto_open_last_ws_v1') === '1'; } catch { return false; } });
  const [connecting, setConnecting] = useState(new Set()); // ids currently connecting
  const [expanded, setExpanded] = useState(() => { try { return JSON.parse(localStorage.getItem('unicon_conn_expanded_v1') || '{}'); } catch { return {}; } }); // id -> bool
  const [logs, setLogs] = useState({}); // id -> [{ts, level, message, code?, hint?}]
  const [menuFor, setMenuFor] = useState(null); // connection id with open dropdown
  const [errorIds, setErrorIds] = useState(new Set()); // ids with recent error
  const retryTimers = React.useRef(new Map());
  const cancelRetries = React.useRef(new Set()); // ids for which auto-retries are canceled
  const [detailsFor, setDetailsFor] = useState(null); // { id, log }
  const [quickTesting, setQuickTesting] = useState(false);
  const [editConn, setEditConn] = useState(null);
  const [wsList, setWsList] = useState([]);
  useEffect(() => { listWorkspaces().then(d=> setWsList(d.workspaces||[])).catch(()=>{}); }, []);
  const moveToWorkspace = async (id, workspaceId) => {
    try {
      await updateConnection(id, { workspaceId: workspaceId || null });
      setConnections(prev => prev.map(c => c.id === id ? { ...c, workspaceId: workspaceId || null } : c));
    } catch (e) {
      alert('Move failed: ' + (e.message || 'error'));
    }
  };

  const TROUBLESHOOT = {
    REST_DNS: { title: 'Hostname not found', tips: [
      'Check the Base URL host name (typos, missing domain).',
      'Try pinging the host from your machine.',
      'If using a container, ensure DNS is configured.'
    ]},
    REST_UNREACHABLE: { title: 'API not reachable', tips: [
      'Verify server is running and reachable from your network.',
      'Check firewalls/VPN and the port number.',
      'If HTTPS is required, ensure the URL starts with https://.'
    ]},
    REST_CONNECT_ERROR: { title: 'REST connection failed', tips: [
      'Confirm the Base URL and any proxy settings.',
      'Inspect the browser Network tab for CORS errors.'
    ]},
    SSH_AUTH: { title: 'SSH authentication failed', tips: [
      'Verify username/password or private key and passphrase.',
      'Ensure the user is allowed to log in on the host.',
      'If using a key, check file format (PEM) and permissions.'
    ]},
    SSH_NETWORK: { title: 'SSH network error', tips: [
      'Check host/port and that the SSH service is listening.',
      'Firewall rules may block port 22 (or your custom port).'
    ]},
    SSH_CONNECT_ERROR: { title: 'SSH connect error', tips: [
      'Test with a local ssh client to validate credentials.',
      'Review server-side sshd logs for details.'
    ]},
    WS_REFUSED: { title: 'WebSocket connection refused', tips: [
      'Ensure the WS server is running and the URL is correct.',
      'Match ws:// vs wss:// with your server configuration.'
    ]},
    WS_CONNECT_ERROR: { title: 'WebSocket connect error', tips: [
      'Open the WS URL in your browser devtools to verify handshakes.',
      'Check reverse proxies and upgrade headers.'
    ]},
    SQL_AUTH: { title: 'Database authentication failed', tips: [
      'Verify DB user and password, and that the user has rights.',
      'For cloud DBs, ensure your IP is allowlisted.'
    ]},
    SQL_NETWORK: { title: 'Database network error', tips: [
      'Verify host/port and connectivity to the DB server.',
      'Check SSL/TLS settings if the DB requires TLS.'
    ]},
    SQL_CONNECT_ERROR: { title: 'Database connect error', tips: [
      'Validate the DSN/connection string format for your driver.'
    ]},
    OPCUA_SECURITY: { title: 'OPC UA certificate/security error', tips: [
      'Trust the client certificate on the server and vice versa.',
      'Align security policy and mode with the server settings.'
    ]},
    OPCUA_CONNECT_ERROR: { title: 'OPC UA connect error', tips: [
      'Confirm endpoint URL is reachable and the server is running.',
      'Try security mode/policy None for initial testing.'
    ]},
    GRPC_UNAVAILABLE: { title: 'gRPC UNAVAILABLE', tips: [
      'Check server address and that the service is listening.',
      'If behind a proxy, ensure HTTP/2 is supported.'
    ]},
    GRPC_CONNECT_ERROR: { title: 'gRPC connect error', tips: [
      'Verify proto/service definitions and server endpoint.'
    ]},
    DISCONNECT_ERROR: { title: 'Disconnect error', tips: [
      'Session may have already closed; refresh state and retry.'
    ]},
    CONNECT_ERROR: { title: 'Connection error', tips: [
      'Check address/credentials and try again.',
      'Use the Retry button; see logs for more detail.'
    ]}
  };

  const tipsFor = (code) => TROUBLESHOOT[code] || null;

  const pushLog = (id, entry) => setLogs(prev => {
    const arr = (prev[id] || []).slice(-49); // keep last 50
    const rec = { ts: new Date().toISOString(), level: entry.level || 'info', message: entry.message, code: entry.code || null, hint: entry.hint || null };
    arr.push(rec);
    try { localStorage.setItem(`unicon_conn_logs_v1_${id}`, JSON.stringify(arr)); } catch {}
    return { ...prev, [id]: arr };
  });

  function statusBeacon(status) {
    const color = status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-amber-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-300';
    return <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${color}`} />;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await listConnections();
      const list = res.connections || [];
      setConnections(list);
      // hydrate persisted logs for new ids
      setLogs(prev => {
        const out = { ...prev };
        for (const c of list) {
          if (!out[c.id]) {
            try {
              const raw = localStorage.getItem(`unicon_conn_logs_v1_${c.id}`);
              if (raw) out[c.id] = JSON.parse(raw);
            } catch {}
          }
        }
        return out;
      });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // Auto-open first connection in last workspace (one-time per session)
  useEffect(() => {
    if (!autoOpen) return;
    if (!connections || connections.length === 0) return;
    try {
      if (sessionStorage.getItem('unicon_auto_open_done_v1') === '1') return;
    } catch {}
    // open first connection using preferred or default workspace
    if (typeof openTab === 'function') {
      const first = connections[0];
      if (first) {
        try {
          // Reuse openFor logic indirectly
          const evt = new Event('unicon-auto-open'); // no-op; just to keep pattern
        } catch {}
        // Choose last workspace kind for this connection
        const lastKind = (() => { try { return localStorage.getItem(`unicon_last_ws_for_${first.id}`); } catch { return null; } })();
        const list = targetsFor(first);
        const chosen = (lastKind && list.find(x => x.kind === lastKind)) ? lastKind : list[0]?.kind;
        if (chosen) openExplicit(first, chosen);
        try { sessionStorage.setItem('unicon_auto_open_done_v1', '1'); } catch {}
      }
    }
  }, [autoOpen, connections]);

  // Listen to backend broadcasts for live status updates
  useEffect(() => {
    const onMsg = (e) => {
      const msg = e.detail;
      if (msg?.type === 'connection_status' && msg?.data?.connectionId) {
        const { connectionId, status } = msg.data;
        setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, status } : c));
        setConnecting(prev => { const next = new Set([...prev]); next.delete(connectionId); return next; });
        pushLog(connectionId, { level: 'info', message: `Status changed to ${status}` });
      } else if (msg?.type === 'log' && msg?.data?.message) {
        const { connectionId, message, type, code, hint } = msg.data || {};
        if (connectionId) {
          const level = type === 'error' ? 'error' : (type === 'warn' ? 'warn' : 'info');
          pushLog(connectionId, { level, message, code, hint });
          if (level === 'error') {
            setErrorIds(prev => new Set([...prev, connectionId]));
            setExpanded(prev => ({ ...prev, [connectionId]: true }));
          }
        }
      }
    };
    window.addEventListener('unicon-ws', onMsg);
    return () => window.removeEventListener('unicon-ws', onMsg);
  }, []);

  async function onCreate(payload) {
    await createConnection(payload);
    setShowDialog(false);
    await load();
  }

  async function onDelete(id) {
    await deleteConnection(id);
    await load();
  }

  async function onToggle(conn) {
    if (conn.status === 'connected') {
      try {
        await disconnectConnection(conn.id);
        pushLog(conn.id, { level: 'info', message: 'Disconnect requested' });
      } catch (e) {
        pushLog(conn.id, { level: 'error', message: e.message || 'Disconnect failed' });
        setErrorIds(prev => new Set([...prev, conn.id]));
        setExpanded(prev => ({ ...prev, [conn.id]: true }));
      } finally {
        await load();
      }
    } else {
      // user-initiated connect clears any previous stop state
      cancelRetries.current.delete(conn.id);
      setConnecting(prev => new Set([...prev, conn.id]));
      pushLog(conn.id, { level: 'info', message: 'Connect requested' });
      try {
        await connectConnection(conn.id);
        setErrorIds(prev => { const next = new Set([...prev]); next.delete(conn.id); return next; });
      } catch (e) {
        pushLog(conn.id, { level: 'error', message: e.message || 'Connect failed' });
        setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, status: 'disconnected' } : c));
        setErrorIds(prev => new Set([...prev, conn.id]));
        setExpanded(prev => ({ ...prev, [conn.id]: true }));
        scheduleRetry(conn.id);
      } finally {
        setConnecting(prev => { const next = new Set([...prev]); next.delete(conn.id); return next; });
        await load();
      }
    }
  }

  const toggleExpanded = (id) => setExpanded(prev => { const next = { ...prev, [id]: !prev[id] }; try { localStorage.setItem('unicon_conn_expanded_v1', JSON.stringify(next)); } catch {} return next; });

  const openDetails = (id) => {
    const lastErr = (logs[id] || []).slice().reverse().find(l => l.level === 'error') || (logs[id] || []).slice(-1)[0] || null;
    setDetailsFor(lastErr ? { id, log: lastErr } : { id, log: null });
  };

  const copyDetails = async () => {
    if (!detailsFor) return;
    try { await navigator.clipboard.writeText(JSON.stringify(detailsFor, null, 2)); } catch {}
  };

  const exportLogs = (id) => {
    const arr = logs[id] || [];
    const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `connection-${id}-logs.json`; a.click(); URL.revokeObjectURL(url);
  };

  const getConn = (id) => connections.find(c => c.id === id);

  const runQuickTest = async (id) => {
    const conn = getConn(id);
    if (!conn) return;
    setQuickTesting(true);
    const ensureConnected = async () => {
      if (conn.status === 'connected') return false;
      pushLog(id, { level: 'info', message: 'Quick test: connecting…' });
      try { await connectConnection(id); return true; } catch (e) { pushLog(id, { level: 'error', message: `Quick test connect failed: ${e.message}` }); return false; }
    };
    const maybeDisconnect = async (didConnect) => { if (didConnect) { try { await disconnectConnection(id); } catch(_) {} } };
    let didConnect = false;
    try {
      let opName = null, params = {};
      const t = (conn.type || '').toLowerCase();
      if (t === 'rest') { opName = 'request'; params = { method: 'GET', endpoint: '/' }; }
      else if (t === 'ws' || t === 'websocket') { opName = 'send'; params = { message: 'ping' }; }
      else if (t === 'ssh') { opName = 'exec'; params = { command: 'echo quick-test', cwd: undefined }; }
      else if (t === 'sql') { opName = 'query'; params = { sql: 'SELECT 1 AS ok', params: [] }; }
      else if (t === 'k8s') { opName = 'contexts'; params = {}; }
      else if (t === 'opcua' || t === 'opc-ua') { opName = 'browse'; params = { nodeId: 'RootFolder' }; }
      else if (t === 'cpd') { opName = 'ping'; params = { message: 'quick-test' }; }
      if (!opName) { pushLog(id, { level: 'warn', message: 'Quick test not available for this type.' }); return; }
      didConnect = await ensureConnected();
      const res = await op(id, opName, params);
      const ok = res?.success !== false;
      pushLog(id, { level: ok ? 'info' : 'error', message: ok ? `Quick test '${opName}' OK` : `Quick test failed: ${res?.error || 'error'}` });
      if (!ok) setExpanded(prev => ({ ...prev, [id]: true }));
    } catch (e) {
      pushLog(id, { level: 'error', message: `Quick test error: ${e.message}` });
      setExpanded(prev => ({ ...prev, [id]: true }));
    } finally {
      try { await maybeDisconnect(didConnect); } catch(_) {}
      setQuickTesting(false);
    }
  };

  function scheduleRetry(id) {
    if (cancelRetries.current.has(id)) {
      // user canceled auto-retries
      return;
    }
    const prev = retryTimers.current.get(id) || { attempt: 0 };
    const nextAttempt = prev.attempt + 1;
    if (nextAttempt > 3) return; // up to 3 auto-retries
    const delay = Math.min(1000 * Math.pow(2, prev.attempt), 8000);
    pushLog(id, { level: 'info', message: `Retrying in ${Math.round(delay/1000)}s (attempt ${nextAttempt}/3)...` });
    const tid = setTimeout(async () => {
      retryTimers.current.delete(id);
      const fakeConn = connections.find(c => c.id === id) || { id, status: 'disconnected' };
      await onToggle(fakeConn);
    }, delay);
    retryTimers.current.set(id, { attempt: nextAttempt, timerId: tid });
  }

  const stopRetry = (id) => {
    const entry = retryTimers.current.get(id);
    if (entry?.timerId) {
      try { clearTimeout(entry.timerId); } catch (_) {}
    }
    retryTimers.current.delete(id);
    cancelRetries.current.add(id);
    setConnecting(prev => { const next = new Set([...prev]); next.delete(id); return next; });
    setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'disconnected' } : c));
    pushLog(id, { level: 'info', message: 'Auto-retry canceled by user' });
  };

  React.useEffect(() => () => {
    for (const { timerId } of retryTimers.current.values()) { try { clearTimeout(timerId); } catch(_) {} }
    retryTimers.current.clear();
  }, []);

  const kindMap = { rest:'rest', ws:'ws', grpc:'grpc', cpd:'cpd', sql:'sql', 'opc-ua':'opcua', opcua:'opcua', ssh:'ssh', k8s:'k8s', ftp:'ftp', sftp:'sftp' };
  const labelMap = { rest:'REST', ws:'WebSocket', grpc:'gRPC', cpd:'CPD', sql:'SQL', opcua:'OPC UA', 'opc-ua':'OPC UA', ssh:'SSH', k8s:'Kubernetes', ftp:'FTP', sftp:'SFTP' };

  const targetsFor = (conn) => {
    const primary = kindMap[conn.type] || 'rest';
    const add = (arr, kind) => {
      if (!arr.find(x => x.kind === kind)) arr.push({ kind, label: labelMap[kind] || kind.toUpperCase() });
    };
    const list = [];
    add(list, primary);
    const cfg = conn?.config || {};
    // Offer REST if a baseUrl exists
    if (cfg.baseUrl) add(list, 'rest');
    // Offer WebSocket if wsUrl exists or baseUrl looks like ws:// or wss://
    if (cfg.wsUrl || /^wss?:/i.test(String(cfg.baseUrl||''))) add(list, 'ws');
    // Offer gRPC if proto + address exist
    if ((cfg.proto || cfg.package || cfg.service) && cfg.address) add(list, 'grpc');
    // Offer SQL if driver present
    if (cfg.driver) add(list, 'sql');
    return list;
  };

  const saveLastWs = (id, kind) => { try { localStorage.setItem(`unicon_last_ws_for_${id}`, kind); } catch {} };
  const getLastWs = (id) => { try { return localStorage.getItem(`unicon_last_ws_for_${id}`) || null; } catch { return null; } };

  const openExplicit = (conn, kind) => {
    saveLastWs(conn.id, kind);
    const label = (Object.values(labelMap).includes(kind) ? kind.toUpperCase() : (labelMap[kind] || kind.toUpperCase()));
    openTab && openTab(kind, { connectionId: conn.id, connection: conn, title: `${(labelMap[kind] || kind.toUpperCase())} • ${conn.name}` });
  };

  const openFor = (conn) => {
    const list = targetsFor(conn);
    const pref = getLastWs(conn.id);
    const chosen = (pref && list.find(x => x.kind === pref)) ? { kind: pref } : list[0];
    openExplicit(conn, chosen.kind);
  };

  const openLabelFor = (conn) => {
    const list = targetsFor(conn)
    return list.length ? `Open in ${list[0].label}` : 'Open'
  };

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Connections</h2>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input type="checkbox" checked={autoOpen} onChange={(e) => { setAutoOpen(e.target.checked); try { localStorage.setItem('unicon_auto_open_last_ws_v1', e.target.checked ? '1' : '0'); } catch {} }} />
            Auto-open first in last workspace
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50" onClick={() => setShowDialog(true)}>
            <Plus size={16} /> New
          </button>
          <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50" title="Clear all logs" onClick={() => {
            if (!confirm('Clear all saved connection logs? This will remove local copies.')) return;
            setLogs({});
            try {
              Object.keys(localStorage)
                .filter(k => k.startsWith('unicon_conn_logs_v1_'))
                .forEach(k => localStorage.removeItem(k));
            } catch {}
            setErrorIds(new Set());
          }}>
            Clear all logs
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Status</th>
              <th className="p-2 text-right">
                <button className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900" onClick={load} title="Refresh">
                  <RefreshCw size={14} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {connections.map(c => {
              const isConnecting = connecting.has(c.id);
              const derivedError = (logs[c.id]?.slice(-1)[0]?.level === 'error');
              const status = isConnecting ? 'connecting' : (derivedError ? 'error' : (c.status || 'disconnected'));
              return (
                <React.Fragment key={c.id}>
                  <tr className="border-t align-top">
                    <td className="p-2">
                      <button className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 mr-2" onClick={() => toggleExpanded(c.id)} title={expanded[c.id] ? 'Hide logs' : 'Show logs'}>
                        {expanded[c.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {(isConnecting || retryTimers.current.has(c.id)) && (
                        <button className="inline-flex items-center gap-1 px-2 py-1 border rounded mr-2 hover:bg-gray-50" title="Stop auto-retry" onClick={() => stopRetry(c.id)}>
                          <X size={14} /> Stop
                        </button>
                      )}
                      <button className="hover:underline" title="Edit connection" onClick={() => { setEditConn(c); setShowDialog(true); }}>{c.name}</button>
                    </td>
                    <td className="p-2 uppercase text-xs text-gray-600">{c.type}</td>
                    <td className="p-2">
                      <div className="inline-flex items-center">
                        {statusBeacon(status)}
                        <span className="capitalize mr-2">{status}</span>
                        {isConnecting && <Spinner size={14} />}
                      </div>
                    </td>
                    <td className="p-2 text-right whitespace-nowrap relative">
                      <span className="inline-flex items-center mr-2">
                        <button className="inline-flex items-center gap-1 px-2 py-1 border rounded-l hover:bg-gray-50" onClick={() => openFor(c)}>
                          {openLabelFor(c)}
                        </button>
                        <button className="px-2 py-1 border border-l-0 rounded-r hover:bg-gray-50" aria-haspopup="menu" aria-expanded={menuFor===c.id} onClick={() => setMenuFor(menuFor===c.id ? null : c.id)}>▾</button>
                      </span>
                      {menuFor === c.id && (
                        <div className="absolute right-2 mt-1 w-44 bg-white border rounded shadow z-10">
                          {targetsFor(c).map(t => (
                            <button key={t.kind} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" onClick={() => { openExplicit(c, t.kind); setMenuFor(null); }}>
                              Open in {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <button className="inline-flex items-center gap-1 px-2 py-1 border rounded mr-2 hover:bg-gray-50" title="Edit" onClick={() => { setEditConn(c); setShowDialog(true); }}>
                        <Pencil size={14} />
                      </button>
                      <span className="inline-flex items-center gap-1 mr-2">
                        <label className="text-xs text-gray-500">Workspace:</label>
                        <select className="border rounded px-1 py-0.5 text-xs" value={c.workspaceId || ''} onChange={(e)=> moveToWorkspace(c.id, e.target.value)}>
                          <option value="">(none)</option>
                          {wsList.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                        </select>
                      </span>
                      <button className="inline-flex items-center gap-1 px-2 py-1 border rounded mr-2 hover:bg-gray-50" onClick={() => onToggle(c)} disabled={isConnecting}>
                        {status === 'connected' ? (<><WifiOff size={14} /> Disconnect</>) : (<><Wifi size={14} /> {isConnecting ? 'Connecting…' : 'Connect'}</>)}
                      </button>
                      {status === 'error' && (
                        <>
                          <button className="inline-flex items-center gap-1 px-2 py-1 border rounded mr-2 hover:bg-gray-50" onClick={() => { cancelRetries.current.delete(c.id); scheduleRetry(c.id); }}>Retry</button>
                          {retryTimers.current.has(c.id) && (
                            <button className="inline-flex items-center gap-1 px-2 py-1 border rounded mr-2 hover:bg-gray-50" onClick={() => stopRetry(c.id)}><X size={14} /> Stop</button>
                          )}
                          <button className="inline-flex items-center gap-1 px-2 py-1 border rounded mr-2 hover:bg-gray-50" onClick={() => openDetails(c.id)}>Details</button>
                        </>
                      )}
                      <button className="inline-flex items-center gap-1 px-2 py-1 border rounded text-red-600 hover:bg-red-50" onClick={() => onDelete(c.id)} disabled={isConnecting}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                  {expanded[c.id] && (
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="p-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-gray-600">Logs</div>
                          <div className="flex items-center gap-2">
                            <button className="px-2 py-0.5 border rounded text-xs" onClick={() => exportLogs(c.id)}>Export</button>
                            <button className="px-2 py-0.5 border rounded text-xs" onClick={() => { setLogs(prev => { const out = { ...prev, [c.id]: [] }; try { localStorage.removeItem(`unicon_conn_logs_v1_${c.id}`); } catch {} return out; }); }}>Clear</button>
                          </div>
                        </div>
                        <div className="max-h-40 overflow-auto text-xs font-mono leading-5">
                          {(logs[c.id] || []).slice().reverse().map((l, idx) => (
                            <div key={idx} className={l.level === 'error' ? 'text-red-700' : (l.level === 'warn' ? 'text-amber-700' : 'text-gray-800')}>
                              <span className="opacity-60 mr-2">{new Date(l.ts).toLocaleTimeString()}</span>
                              {l.message}
                              {l.code || l.hint ? (<span className="opacity-80"> {l.code ? `[${l.code}]` : ''}{l.hint ? ` – ${l.hint}` : ''}</span>) : null}
                            </div>
                          ))}
                          {(!logs[c.id] || logs[c.id].length === 0) && (
                            <div className="text-gray-500">No logs yet.</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {connections.length === 0 && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={4}>{loading ? 'Loading...' : 'No connections'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showDialog && (
        <ConnectionDialog
          initial={editConn}
          onClose={() => { setShowDialog(false); setEditConn(null); }}
          onSave={async (payload, id) => {
            if (id) { await updateConnection(id, payload); } else { await createConnection(payload); }
            setShowDialog(false); setEditConn(null); await load();
          }}
        />
      )}

      <Modal
        open={!!detailsFor}
        title="Connection details"
        onClose={() => setDetailsFor(null)}
        footer={(
          <>
            {detailsFor ? (
              <>
                <button className="px-3 py-1.5 border rounded" onClick={() => { const c = getConn(detailsFor.id); if (c) { setEditConn(c); setShowDialog(true); } }}>Edit</button>
                <button className="px-3 py-1.5 border rounded" disabled={quickTesting} onClick={() => runQuickTest(detailsFor.id)}>{quickTesting ? 'Testing…' : 'Quick test'}</button>
                <button className="px-3 py-1.5 border rounded" onClick={copyDetails}>Copy</button>
                <button className="px-3 py-1.5 border rounded" onClick={() => exportLogs(detailsFor.id)}>Export logs</button>
              </>
            ) : null}
            <button className="px-3 py-1.5 border rounded bg-blue-600 text-white" onClick={() => setDetailsFor(null)}>Close</button>
          </>
        )}
      >
        {detailsFor?.log ? (
          <div className="text-sm">
            <div className="mb-2"><span className="font-semibold">Time:</span> {new Date(detailsFor.log.ts).toLocaleString()}</div>
            <div className="mb-2"><span className="font-semibold">Level:</span> {detailsFor.log.level}</div>
            {detailsFor.log.code ? <div className="mb-2"><span className="font-semibold">Code:</span> {detailsFor.log.code}</div> : null}
            {detailsFor.log.hint ? <div className="mb-2"><span className="font-semibold">Hint:</span> {detailsFor.log.hint}</div> : null}
            <div className="mb-4"><span className="font-semibold">Message:</span> {detailsFor.log.message}</div>
            {detailsFor.log.code && tipsFor(detailsFor.log.code) ? (
              <div className="mt-4 border-t pt-3">
                <div className="font-semibold mb-1">Troubleshooting: {tipsFor(detailsFor.log.code).title}</div>
                <ul className="list-disc ml-5 space-y-1">
                  {tipsFor(detailsFor.log.code).tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-gray-600">No error details available.</div>
        )}
      </Modal>
    </div>
  );
}

function ConnectionDialog({ initial=null, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || 'My REST');
  const [type, setType] = useState(initial?.type || 'rest');
  const [baseUrl, setBaseUrl] = useState(initial?.config?.baseUrl || 'https://jsonplaceholder.typicode.com');
  // Workspace selector
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(() => { try { return initial?.workspaceId || localStorage.getItem('unicon_current_workspace_v1') || ''; } catch { return initial?.workspaceId || ''; } });
  useEffect(() => { listWorkspaces().then(d=> setWorkspaces(d.workspaces||[])).catch(()=>{}); }, []);
  // SSH fields
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUser, setSshUser] = useState('root');
  const [sshAuthType, setSshAuthType] = useState('password');
  const [sshPassword, setSshPassword] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [sshPassphrase, setSshPassphrase] = useState('');
  // FTP fields
  const [ftpHost, setFtpHost] = useState('');
  const [ftpPort, setFtpPort] = useState(21);
  const [ftpUser, setFtpUser] = useState('');
  const [ftpPwd, setFtpPwd] = useState('');
  const [ftpSecure, setFtpSecure] = useState(false);
  const [ftpPassive, setFtpPassive] = useState(true);
  // OPC UA fields
  const [opcEndpointUrl, setOpcEndpointUrl] = useState(initial?.config?.endpointUrl || '');
  const [opcSecurityPolicy, setOpcSecurityPolicy] = useState(initial?.config?.securityPolicy || 'None');
  const [opcSecurityMode, setOpcSecurityMode] = useState(initial?.config?.securityMode || 'None');
  const [opcUser, setOpcUser] = useState(initial?.config?.username || '');
  const [opcPwd, setOpcPwd] = useState(''); // do not prefill from stored config
  // SQL fields
  const [sqlDriver, setSqlDriver] = useState(initial?.config?.driver || 'sqlite');
  const [sqlFilename, setSqlFilename] = useState(initial?.config?.filename || ':memory:');
  const [sqlUrl, setSqlUrl] = useState(initial?.config?.url || initial?.config?.connectionString || '');
  // K8s fields
  const [kubeSource, setKubeSource] = useState('default');
  const [kubePath, setKubePath] = useState('');
  const [kubeInline, setKubeInline] = useState('');
  const [kubeContext, setKubeContext] = useState('');
  const [kubeNamespace, setKubeNamespace] = useState('default');

  const onSubmit = () => {
    if (!name.trim()) return;
    let config = {};
    const trim = (s) => (typeof s === 'string' ? s.trim() : s);
    if (type === 'rest') {
      config = { baseUrl };
    } else if (type === 'sql') {
      if (sqlDriver === 'sqlite') config = { driver: 'sqlite', filename: sqlFilename };
      if (sqlDriver === 'pg') config = { driver: 'pg', url: sqlUrl };
      if (sqlDriver === 'mysql') config = { driver: 'mysql', url: sqlUrl };
    } else if (type === 'opc-ua' || type === 'opcua') {
      const url = trim(opcEndpointUrl || '');
      const m = url.match(/^opc\.tcp:\/\/([^:\/]+):(\d{1,5})(\/.*)?$/i);
      if (!m) {
        alert('Invalid OPC UA endpoint. Use opc.tcp://host:port (e.g., opc.tcp://localhost:4840)');
        return;
      }
      const path = m[3] || '';
      // Enforce valid combinations
      if (opcSecurityPolicy === 'None' && opcSecurityMode !== 'None') {
        alert('Security Mode must be None when Security Policy is None.');
        return;
      }
      // If credentials are provided with an insecure channel, warn but allow (some servers permit this).
      if ((opcUser || opcPwd) && (opcSecurityMode === 'None' || opcSecurityPolicy === 'None')) {
        const cont = confirm('Warning: using username/password without a secure channel will send credentials unencrypted. Continue anyway?');
        if (!cont) return;
      }
      config = {
        endpointUrl: `opc.tcp://${m[1]}:${m[2]}${path}`,
        securityPolicy: opcSecurityPolicy,
        securityMode: opcSecurityMode,
        ...(opcUser ? { username: opcUser } : {}),
        ...(opcPwd ? { password: opcPwd } : {})
      };
    } else if (type === 'ssh') {
      config = {
        host: sshHost, port: Number(sshPort), username: sshUser,
        ...(sshAuthType === 'password' ? { password: sshPassword } : { privateKey: sshPrivateKey, passphrase: sshPassphrase })
      };
    } else if (type === 'k8s') {
      const kubeconfig = kubeSource === 'inline' ? kubeInline : undefined;
      const kubeconfigPath = kubeSource === 'path' ? kubePath : undefined;
      config = { kubeconfigSource: kubeSource, kubeconfig, kubeconfigPath, context: kubeContext, namespace: kubeNamespace };
    } else if (type === 'ftp') {
      config = {
        host: ftpHost,
        port: Number(ftpPort || 21),
        user: ftpUser || undefined,
        password: ftpPwd || undefined,
        secure: !!ftpSecure,
        passive: !!ftpPassive
      };
    } else if (type === 'sftp') {
      config = {
        host: sshHost,
        port: Number(sshPort || 22),
        username: sshUser,
        ...(sshAuthType === 'password' ? { password: sshPassword } : { privateKey: sshPrivateKey, passphrase: sshPassphrase })
      };
    }
    onSave({ name: name.trim(), type, config, workspaceId: workspaceId || null }, initial?.id);
  };

  const [lib, setLib] = useState(getLibrary());
  React.useEffect(()=>{ (async ()=>{ try { const remote = await serverList(); setLib(remote); localStorage.setItem('unicon_templates_v1', JSON.stringify(remote)); } catch {} })(); }, []);

  const applyTemplate = (tmpl) => {
    if (!tmpl) return;
    const t = (tmpl.type||'').toLowerCase();
    if (t === 'rest') { setType('rest'); setBaseUrl(tmpl.config?.baseUrl || ''); }
    else if (t === 'sql') { setType('sql'); const d=tmpl.config?.driver||'sqlite'; setSqlDriver(d); setSqlFilename(tmpl.config?.filename||':memory:'); setSqlUrl(tmpl.config?.url||tmpl.config?.connectionString||''); }
    else if (t === 'opc-ua' || t === 'opcua') { setType('opc-ua'); setOpcEndpointUrl(tmpl.config?.endpointUrl || ''); setOpcSecurityPolicy(tmpl.config?.securityPolicy || 'None'); setOpcSecurityMode(tmpl.config?.securityMode || 'None'); setOpcUser(tmpl.config?.username || ''); setOpcPwd(''); }
    else if (t === 'websocket' || t === 'ws') { setType('ws'); /* no ws dialog fields here */ }
  };

  const saveCurrentAsTemplate = async () => {
    let tmpl = null;
    if (type === 'rest') tmpl = { name, type: 'rest', config: { baseUrl } };
    else if (type === 'sql') {
      tmpl = sqlDriver === 'sqlite' ? { name, type: 'sql', config: { driver: 'sqlite', filename: sqlFilename } } : { name, type: 'sql', config: { driver: sqlDriver, url: sqlUrl } };
    } else if (type === 'opc-ua' || type === 'opcua') {
      tmpl = { name, type: 'opc-ua', config: { endpointUrl: opcEndpointUrl, securityPolicy: opcSecurityPolicy, securityMode: opcSecurityMode, ...(opcUser?{username:opcUser}:{}) } };
    } else if (type === 'ws' || type === 'websocket') {
      tmpl = { name, type: 'websocket', config: {} };
    }
    if (tmpl) {
      try { await serverAdd(tmpl); const remote = await serverList(); setLib(remote); localStorage.setItem('unicon_templates_v1', JSON.stringify(remote)); }
      catch { saveTemplate(tmpl); setLib(getLibrary()); }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-lg w-full max-w-md">
        <div className="p-4 border-b font-semibold">{initial ? 'Edit Connection' : 'New Connection'}</div>
        <div className="p-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input className="w-full border rounded px-3 py-2" value={name} onChange={e => setName(e.target.value)} />
            </div>
          <div>
            <label className="block text-sm mb-1">Type</label>
            <select className="w-full border rounded px-3 py-2" value={type} onChange={e => setType(e.target.value)}>
              <option value="rest">REST</option>
              <option value="opc-ua">OPC UA</option>
              <option value="ws">WebSocket</option>
              <option value="grpc">gRPC</option>
              <option value="cpd">CPD</option>
              <option value="sql">SQL</option>
              <option value="ssh">SSH</option>
              <option value="ftp">FTP</option>
              <option value="sftp">SFTP</option>
              <option value="k8s">Kubernetes</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Workspace</label>
            <select className="w-full border rounded px-3 py-2" value={workspaceId} onChange={e=> setWorkspaceId(e.target.value)}>
              <option value="">— None —</option>
              {workspaces.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
            </select>
          </div>
            {type === 'rest' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm mb-1">Base URL</label>
                  <div className="text-xs text-gray-600">
                    Suggestion:
                    <select className="ml-2 border rounded px-2 py-1" onChange={(e)=>{ const idx=Number(e.target.value); if (!isNaN(idx)) setBaseUrl(EXAMPLE_PRESETS.rest[idx].baseUrl); }}>
                      <option>Pick…</option>
                      {EXAMPLE_PRESETS.rest.map((ex, i)=> (<option key={ex.name} value={i}>{ex.name}</option>))}
                    </select>
                  </div>
                </div>
                <input className="w-full border rounded px-3 py-2" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com" />
                <div className="mt-2 text-xs text-gray-600">
                  From My Library:
                  <select className="ml-2 border rounded px-2 py-1" onChange={(e)=>{ const t=lib.find(x=>x.id===e.target.value); applyTemplate(t); }}>
                    <option value="">Pick…</option>
                    {lib.filter(t=> (t.type||'').toLowerCase()==='rest').map(t=>(<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                  <button className="ml-2 px-2 py-1 border rounded" onClick={saveCurrentAsTemplate}>Save as template</button>
                </div>
              </div>
            )}

            {type === 'sql' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm mb-1">Driver</label>
                  <div className="text-xs text-gray-600">
                    Suggestion:
                    <select className="ml-2 border rounded px-2 py-1" onChange={(e)=>{
                      const idx = Number(e.target.value); if (isNaN(idx)) return; const ex = EXAMPLE_PRESETS.sql[idx];
                      setSqlDriver(ex.config.driver || 'sqlite'); setSqlFilename(ex.config.filename||':memory:'); setSqlUrl(ex.config.url||'');
                    }}>
                      <option>Pick…</option>
                      {EXAMPLE_PRESETS.sql.map((ex,i)=>(<option key={ex.name} value={i}>{ex.name}</option>))}
                    </select>
                  </div>
                </div>
                <div>
                  <select className="w-full border rounded px-3 py-2" value={sqlDriver} onChange={e=> setSqlDriver(e.target.value)}>
                    <option value="sqlite">SQLite</option>
                    <option value="pg">PostgreSQL / TimescaleDB</option>
                    <option value="mysql">MySQL / MariaDB</option>
                  </select>
                </div>
                {sqlDriver === 'sqlite' && (
                  <div>
                    <label className="block text-sm mb-1">SQLite filename</label>
                    <input className="w-full border rounded px-3 py-2" value={sqlFilename} onChange={e=> setSqlFilename(e.target.value)} placeholder=":memory:" />
                  </div>
                )}
                {sqlDriver !== 'sqlite' && (
                  <div>
                    <label className="block text-sm mb-1">Connection string (URL)</label>
                    <input className="w-full border rounded px-3 py-2" value={sqlUrl} onChange={e=> setSqlUrl(e.target.value)} placeholder={sqlDriver==='pg' ? 'postgres://user:pass@host:5432/db' : 'mysql://user:pass@host:3306/db'} />
                    <div className="text-xs text-gray-500 mt-1">TimescaleDB uses the PostgreSQL URL format.</div>
                  </div>
                )}
                <div className="text-xs text-gray-600">
                  From My Library:
                  <select className="ml-2 border rounded px-2 py-1" onChange={(e)=>{ const t=lib.find(x=>x.id===e.target.value); applyTemplate(t); }}>
                    <option value="">Pick…</option>
                    {lib.filter(t=> (t.type||'').toLowerCase()==='sql').map(t=>(<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                  <button className="ml-2 px-2 py-1 border rounded" onClick={saveCurrentAsTemplate}>Save as template</button>
                </div>
              </div>
            )}

            {(type === 'opc-ua' || type === 'opcua') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm mb-1">Endpoint URL</label>
                  <div className="text-xs text-gray-600">
                    Suggestion:
                    <select className="ml-2 border rounded px-2 py-1" onChange={(e)=>{ const idx=Number(e.target.value); if (isNaN(idx)) return; const ex = EXAMPLE_PRESETS.opcua[idx]; setOpcEndpointUrl(ex.endpointUrl); setOpcSecurityPolicy(ex.securityPolicy||'None'); setOpcSecurityMode(ex.securityMode||'None'); }}>
                      <option>Pick…</option>
                      {EXAMPLE_PRESETS.opcua.map((ex,i)=>(<option key={ex.name} value={i}>{ex.name}</option>))}
                    </select>
                  </div>
                </div>
                <input className="w-full border rounded px-3 py-2" value={opcEndpointUrl} onChange={e => setOpcEndpointUrl(e.target.value)} placeholder="opc.tcp://host:4840 or opc.tcp://host:4840/Path" />
                <div className="text-xs text-gray-600">
                  From My Library:
                  <select className="ml-2 border rounded px-2 py-1" onChange={(e)=>{ const t=lib.find(x=>x.id===e.target.value); applyTemplate(t); }}>
                    <option value="">Pick…</option>
                    {lib.filter(t=> ['opc-ua','opcua'].includes((t.type||'').toLowerCase())).map(t=>(<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                  <button className="ml-2 px-2 py-1 border rounded" onClick={saveCurrentAsTemplate}>Save as template</button>
                </div>
                <div className="text-xs text-amber-600">Public OPC UA demo endpoints can be unstable. If connection fails, try again or use a local server.</div>
                <div>
                  <label className="block text-sm mb-1">Endpoint URL</label>
                  <input className="w-full border rounded px-3 py-2" value={opcEndpointUrl} onChange={e => setOpcEndpointUrl(e.target.value)} placeholder="opc.tcp://host:4840 or opc.tcp://host:4840/Path" />
                  <div className="text-xs text-gray-500 mt-1">Format: opc.tcp://host:port[/path], e.g., opc.tcp://localhost:4840 or opc.tcp://server:4840/OPCUA/Sim</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Security Policy</label>
                    <select className="w-full border rounded px-3 py-2" value={opcSecurityPolicy} onChange={e => setOpcSecurityPolicy(e.target.value)}>
                      <option>None</option>
                      <option>Basic128Rsa15</option>
                      <option>Basic256</option>
                      <option>Basic256Sha256</option>
                      <option>Aes128_Sha256_RsaOaep</option>
                      <option>Aes256_Sha256_RsaPss</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Security Mode</label>
                    <select className="w-full border rounded px-3 py-2" value={opcSecurityMode} onChange={e => setOpcSecurityMode(e.target.value)}>
                      <option>None</option>
                      <option>Sign</option>
                      <option>SignAndEncrypt</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Username (optional)</label>
                    <input className="w-full border rounded px-3 py-2" value={opcUser} onChange={e => setOpcUser(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Password (optional)</label>
                    <input type="password" className="w-full border rounded px-3 py-2" value={opcPwd} onChange={e => setOpcPwd(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            {(type === 'ssh' || type === 'sftp') && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Host</label>
                    <input className="w-full border rounded px-3 py-2" value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="server.example.com" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Port</label>
                    <input type="number" className="w-full border rounded px-3 py-2" value={sshPort} onChange={e => setSshPort(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Username</label>
                    <input className="w-full border rounded px-3 py-2" value={sshUser} onChange={e => setSshUser(e.target.value)} placeholder="root" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Auth Type</label>
                    <select className="w-full border rounded px-3 py-2" value={sshAuthType} onChange={e => setSshAuthType(e.target.value)}>
                      <option value="password">Password</option>
                      <option value="privateKey">Private Key</option>
                    </select>
                  </div>
                </div>
                {sshAuthType === 'password' ? (
                  <div>
                    <label className="block text-sm mb-1">Password</label>
                    <input type="password" className="w-full border rounded px-3 py-2" value={sshPassword} onChange={e => setSshPassword(e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-sm mb-1">Private Key (PEM)</label>
                      <textarea className="w-full border rounded px-3 py-2 font-mono text-xs" rows={5} value={sshPrivateKey} onChange={e => setSshPrivateKey(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Passphrase (optional)</label>
                      <input type="password" className="w-full border rounded px-3 py-2" value={sshPassphrase} onChange={e => setSshPassphrase(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {type === 'k8s' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1">Kubeconfig Source</label>
                  <select className="w-full border rounded px-3 py-2" value={kubeSource} onChange={e => setKubeSource(e.target.value)}>
                    <option value="default">Default</option>
                    <option value="path">Path</option>
                    <option value="inline">Inline</option>
                  </select>
                </div>
                {kubeSource === 'path' && (
                  <div>
                    <label className="block text-sm mb-1">Kubeconfig Path</label>
                    <input className="w-full border rounded px-3 py-2" value={kubePath} onChange={e => setKubePath(e.target.value)} placeholder="C:/Users/me/.kube/config" />
                  </div>
                )}
                {kubeSource === 'inline' && (
                  <div>
                    <label className="block text-sm mb-1">Kubeconfig (YAML)</label>
                    <textarea className="w-full border rounded px-3 py-2 font-mono text-xs" rows={6} value={kubeInline} onChange={e => setKubeInline(e.target.value)} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Context (optional)</label>
                    <input className="w-full border rounded px-3 py-2" value={kubeContext} onChange={e => setKubeContext(e.target.value)} placeholder="my-context" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Default Namespace</label>
                    <input className="w-full border rounded px-3 py-2" value={kubeNamespace} onChange={e => setKubeNamespace(e.target.value)} placeholder="default" />
                  </div>
                </div>
              </div>
            )}

            {type === 'ftp' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Host</label>
                    <input className="w-full border rounded px-3 py-2" value={ftpHost} onChange={e=>setFtpHost(e.target.value)} placeholder="ftp.example.com" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Port</label>
                    <input type="number" className="w-full border rounded px-3 py-2" value={ftpPort} onChange={e=>setFtpPort(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm mb-1">Username</label>
                    <input className="w-full border rounded px-3 py-2" value={ftpUser} onChange={e=>setFtpUser(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Password</label>
                    <input type="password" className="w-full border rounded px-3 py-2" value={ftpPwd} onChange={e=>setFtpPwd(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ftpSecure} onChange={e=>setFtpSecure(e.target.checked)} /> FTPS (secure)</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ftpPassive} onChange={e=>setFtpPassive(e.target.checked)} /> Passive mode</label>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 border-t pt-4 flex justify-between gap-2">
            <div>
              <button className="px-3 py-1.5 border rounded" onClick={saveCurrentAsTemplate} title="Save current form as reusable template">Save as template</button>
            </div>
            <button className="px-3 py-1.5 border rounded" onClick={onClose}>Cancel</button>
            <button className="px-3 py-1.5 border rounded bg-blue-600 text-white" onClick={onSubmit}>{initial? 'Save' : 'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
