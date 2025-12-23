// client/src/workspaces/sql/SqlWorkspace.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listConnections, connectConnection, disconnectConnection, op } from '../../lib/api';
import { Play, Square, RefreshCw } from 'lucide-react';

export default function SqlWorkspace() {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [driver, setDriver] = useState('sqlite');

  const [sql, setSql] = useState('SELECT 1 AS test;');
  const [paramsText, setParamsText] = useState('[]');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 100;

  const sqlConnections = useMemo(() => (connections || []).filter(c => c.type === 'sql'), [connections]);

  useEffect(() => {
    (async () => {
      const res = await listConnections();
      setConnections(res.connections || []);
      const first = (res.connections || []).find(c => c.type === 'sql');
      if (first) { setSelectedId(first.id); setDriver(first.config?.driver || 'sqlite'); }
    })();
  }, []);

  async function onConnect() {
    if (!selectedId) return;
    setLoading(true);
    try {
      await connectConnection(selectedId);
      setStatus('connected');
    } finally { setLoading(false); }
  }
  async function onDisconnect() {
    if (!selectedId) return;
    setLoading(true);
    try {
      await disconnectConnection(selectedId);
      setStatus('disconnected');
      setRows([]); setMeta(null);
    } finally { setLoading(false); }
  }

  function parseParams() {
    try {
      const val = JSON.parse(paramsText || '[]');
      return Array.isArray(val) ? val : [];
    } catch { return []; }
  }

  async function runQuery() {
    if (!selectedId || status !== 'connected') return;
    setLoading(true);
    try {
      const res = await op(selectedId, 'query', { sql, params: parseParams() });
      const data = res?.data || res;
      if (Array.isArray(data.rows)) {
        setRows(data.rows);
        setMeta({ rowCount: data.rows.length });
        setPage(1);
      } else {
        setRows([]);
        setMeta(data);
      }
    } catch (e) {
      setRows([]);
      setMeta({ error: e.message });
    } finally { setLoading(false); }
  }

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);
  const columns = useMemo(() => rows.length ? Object.keys(rows[0]) : [], [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-sm text-gray-600">SQL Connection</label>
          <select className="border rounded px-3 py-2 min-w-[16rem]" value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); const cfg = sqlConnections.find(c=>c.id===e.target.value)?.config; setDriver(cfg?.driver||'sqlite'); }}>
            {sqlConnections.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.config?.driver || 'sqlite'})</option>
            ))}
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
        <div className="text-sm text-gray-600">Driver: {driver}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">SQL</label>
          <textarea rows={6} className="w-full border rounded px-3 py-2 font-mono text-sm" value={sql} onChange={e=>setSql(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">Params (JSON array)</label>
          <textarea rows={6} className="w-full border rounded px-3 py-2 font-mono text-sm" value={paramsText} onChange={e=>setParamsText(e.target.value)} />
        </div>
      </div>

      <div>
        <button onClick={runQuery} disabled={loading || status!=='connected'} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
          {loading ? 'Running…' : 'Execute'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button className="px-2 py-1 border rounded text-sm" disabled={!rows.length} onClick={()=>exportCSV(rows, 'query-results.csv')}>Export CSV</button>
        <button className="px-2 py-1 border rounded text-sm" onClick={()=>saveQuery(sql, paramsText)}>Save Query</button>
        <button className="px-2 py-1 border rounded text-sm" onClick={()=>loadQuery(setSql, setParamsText)}>Load Last</button>
      </div>

      {rows.length > 0 && (
        <div className="border rounded">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 text-sm">
            <div>{rows.length} rows</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 border rounded" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button className="px-2 py-1 border rounded" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{columns.map(col => (<th key={col} className="text-left px-3 py-2 border-b font-medium">{col}</th>))}</tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} className="border-b">
                    {columns.map(col => (<td key={col} className="px-3 py-1 font-mono">{String(r[col])}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {meta && !rows.length && (
        <div className="text-sm text-gray-700 bg-gray-50 border rounded p-3"><pre>{JSON.stringify(meta, null, 2)}</pre></div>
      )}
    </div>
  );
}

function exportCSV(rows, filename) {
  if (!rows || !rows.length) return;
  const cols = Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')].concat(rows.map(r => cols.map(c => escape(r[c])).join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function saveQuery(sql, paramsText) {
  const saved = { sql, paramsText, ts: Date.now() };
  localStorage.setItem('sql_saved_last', JSON.stringify(saved));
}

function loadQuery(setSql, setParamsText) {
  try {
    const saved = JSON.parse(localStorage.getItem('sql_saved_last') || 'null');
    if (saved) { setSql(saved.sql || ''); setParamsText(saved.paramsText || '[]'); }
  } catch {}
}
