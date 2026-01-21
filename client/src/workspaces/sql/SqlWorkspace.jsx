// client/src/workspaces/sql/SqlWorkspace.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { listConnections, connectConnection, disconnectConnection, op } from '../../lib/api';
import { Play, Square, RefreshCw } from 'lucide-react';
import Button from '../../ui/Button.jsx';
import Input from '../../ui/Input.jsx';
import Spinner from '../../ui/Spinner.jsx';
import ConnectionBadge from '../../ui/ConnectionBadge.jsx';
import ConnectionLog from '../../components/ConnectionLog.jsx';
import { EXAMPLE_PRESETS } from '../../features/examples/presets.js';
import { createConnection } from '../../lib/api';

export default function SqlWorkspace({ connectionId: initialConnectionId }) {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [driver, setDriver] = useState('sqlite');

  const [sql, setSql] = useState('SELECT 1 AS test;');
  const [paramsText, setParamsText] = useState('[]');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  // sort & filter
  const [sortBy, setSortBy] = useState(null); // column name
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [filters, setFilters] = useState({}); // { col: text }

  const [page, setPage] = useState(1);
  const pageSize = 100;

  const sqlConnections = useMemo(() => (connections || []).filter(c => c.type === 'sql'), [connections]);

  useEffect(() => {
    (async () => {
      const res = await listConnections();
      setConnections(res.connections || []);
      const list = (res.connections || []).filter(c => c.type === 'sql');
      const preferred = list.find(c => c.id === initialConnectionId);
      const first = preferred || list[0];
      if (first) { setSelectedId(first.id); setDriver(first.config?.driver || 'sqlite'); }
    })();
  }, [initialConnectionId]);

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

  const shouldIncludePayload = () => { try { return localStorage.getItem('unicon_log_include_payload') !== '0'; } catch { return true; } };
  const redactDeep = (input) => {
    const mask = (v) => v ? '***' : v;
    const keys = /^(password|passwd|token|api[-_]?key|secret)$/i;
    const recur = (v) => {
      if (!v || typeof v !== 'object') return v;
      if (Array.isArray(v)) return v.map(recur);
      const out = {};
      for (const [k, val] of Object.entries(v)) { out[k] = keys.test(k) ? mask(val) : recur(val); }
      return out;
    };
    try { return recur(input); } catch { return input; }
  };

  const getHintLimit = () => { try { const n = parseInt(localStorage.getItem('unicon_log_hint_limit')||'800',10); return isNaN(n)?800:Math.min(5000,Math.max(100,n)); } catch { return 800; } };

  async function runQuery() {
    if (!selectedId || status !== 'connected') return;
    setLoading(true);
    try {
      const detail = { connectionId: selectedId, kind: 'sql', message: (sql||'').slice(0,200) };
      if (shouldIncludePayload()) {
        const p = redactDeep(parseParams());
        const limit = getHintLimit();
        detail.hint = JSON.stringify(p).slice(0, limit);
      }
      window.dispatchEvent(new CustomEvent('unicon-log', { detail }));
    } catch(_){}
    try {
      const t0 = performance.now();
      const res = await op(selectedId, 'query', { sql, params: parseParams() });
      const ms = Math.round(performance.now() - t0);
      const data = res?.data || res;
      const includeResp = (()=>{ try { return localStorage.getItem('unicon_log_include_resp') !== '0'; } catch { return true; } })();
      if (Array.isArray(data.rows)) {
        setRows(data.rows);
        setMeta({ rowCount: data.rows.length });
        setPage(1);
        try { if (includeResp) { const limit=getHintLimit(); const preview = JSON.stringify(data.rows.slice(0, 10)); window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: selectedId, kind: 'sql_result', message: `rows=${data.rows.length}`, hint: preview.slice(0, limit) } })); } } catch(_){}
      } else {
        setRows([]);
        setMeta(data);
        try { if (includeResp) { const limit=getHintLimit(); const preview = JSON.stringify(data); window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: selectedId, kind: 'sql_result', message: 'meta', hint: preview.slice(0, limit) } })); } } catch(_){}
      }
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: selectedId, kind: 'info', message: `SQL done (${ms}ms)` } })); } catch(_){}
    } catch (e) {
      setRows([]);
      setMeta({ error: e.message });
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: selectedId, kind: 'error', message: `SQL error: ${e.message}` } })); } catch(_){}
    } finally { setLoading(false); }
  }

  const filteredSorted = useMemo(() => {
    let r = rows;
    // filter
    const keys = Object.keys(filters || {});
    if (keys.length) {
      r = r.filter(row => keys.every(k => {
        const f = (filters[k] || '').toString().trim(); if (!f) return true;
        const v = row[k];
        return String(v ?? '').toLowerCase().includes(f.toLowerCase());
      }));
    }
    // sort
    if (sortBy) {
      const dir = sortDir === 'desc' ? -1 : 1;
      r = [...r].sort((a,b) => {
        const va = a?.[sortBy]; const vb = b?.[sortBy];
        if (va == null && vb == null) return 0;
        if (va == null) return -1*dir; if (vb == null) return 1*dir;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        const sa = String(va); const sb = String(vb);
        return sa.localeCompare(sb) * dir;
      });
    }
    return r;
  }, [rows, filters, sortBy, sortDir]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page]);
  const columns = useMemo(() => filteredSorted.length ? Object.keys(filteredSorted[0]) : [], [filteredSorted]);
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="text-sm text-gray-700">
          Quick pick:
          <select className="ml-2 border rounded px-2 py-1" onChange={async (e)=>{
            const idx = Number(e.target.value); if (isNaN(idx)) return;
            const ex = EXAMPLE_PRESETS.sql[idx];
            const res = await createConnection({ name: ex.name, type: 'sql', config: ex.config });
            const conn = res.connection; setSelectedId(conn.id); setDriver(conn.config?.driver||'sqlite');
          }}>
            <option>Pick…</option>
            {EXAMPLE_PRESETS.sql.map((ex,i)=>(<option key={ex.name} value={i}>{ex.name}</option>))}
          </select>
        </div>
        <ConnectionHeader connections={connections} selectedId={selectedId} status={status} />
        <div>
          <label className="block text-sm text-gray-600">SQL Connection</label>
          <select className="border border-swarco-grey-400 rounded px-3 py-2 min-w-[16rem] focus:outline-none focus:ring-2 focus:ring-swarco-blue-200 focus:border-swarco-blue-600" value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); const cfg = sqlConnections.find(c=>c.id===e.target.value)?.config; setDriver(cfg?.driver||'sqlite'); }}>
            {sqlConnections.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.config?.driver || 'sqlite'})</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
<Button variant="secondary" onClick={onConnect} disabled={!selectedId || loading || status==='connected'} leftEl={loading ? <Spinner size={14} /> : <Play size={14} className="mr-1"/>}>Connect</Button>
          <Button variant="secondary" onClick={onDisconnect} disabled={!selectedId || loading || status!=='connected'} leftEl={<Square size={14} className="mr-1"/>}>Disconnect</Button>
        </div>
        <div className="text-sm text-gray-600">Driver: {driver}</div>
      </div>

      <ConnectionLog connectionId={selectedId} className="-mt-2" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">SQL</label>
          <textarea rows={6} className="w-full border border-swarco-grey-400 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-swarco-blue-200 focus:border-swarco-blue-600" value={sql} onChange={e=>setSql(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">Params (JSON array)</label>
          <textarea rows={6} className="w-full border border-swarco-grey-400 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-swarco-blue-200 focus:border-swarco-blue-600" value={paramsText} onChange={e=>setParamsText(e.target.value)} />
        </div>
      </div>

      <div>
        <Button onClick={runQuery} disabled={loading || status!=='connected'}>
          {loading ? 'Running…' : 'Execute'}
        </Button>
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
                <tr>
                  {columns.map(col => (
                    <th key={col} className="text-left px-3 py-2 border-b font-medium">
                      <button className="inline-flex items-center gap-1" onClick={()=>{
                        if (sortBy === col) setSortDir(d => d==='asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('asc'); }
                      }}>
                        {col}
                        {sortBy === col && <span className="text-xs opacity-60">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </button>
                    </th>
                  ))}
                </tr>
                {/* filters row */}
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-3 pb-2 border-b">
                      <input className="w-full border rounded px-2 py-1 text-xs" placeholder="filter" value={filters[col]||''}
                             onChange={e=>{ const v=e.target.value; setFilters(prev=>({ ...prev, [col]: v })); setPage(1); }} />
                    </th>
                  ))}
                </tr>
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

function ConnectionHeader({ connections, selectedId, status }) {
  const sel = (connections || []).find(c => c.id === selectedId) || null;
  return (
    <div className="ml-auto">
      <ConnectionBadge connection={sel || undefined} status={status} />
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
