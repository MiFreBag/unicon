// client/src/components/ConnectionLog.jsx
import React from 'react';
import { Clock, Trash2, Copy } from 'lucide-react';

export default function ConnectionLog({ connectionId, includeBrowser = true, max = 200, className = '' }) {
  const [items, setItems] = React.useState([]);
  const [filterKind, setFilterKind] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [persist, setPersist] = React.useState(() => { try { return localStorage.getItem('unicon_log_persist') !== '0'; } catch { return true; } });
  const [follow, setFollow] = React.useState(() => { try { return localStorage.getItem('unicon_log_follow') !== '0'; } catch { return true; } });
  const [paused, setPaused] = React.useState(() => { try { return localStorage.getItem('unicon_log_paused') === '1'; } catch { return false; } });
  const itemsRef = React.useRef([]);
  const storageKey = React.useMemo(() => `unicon_log_${connectionId || 'global'}`, [connectionId]);
  const viewRef = React.useRef(null);

  const pushed = (entry) => {
    itemsRef.current = [entry, ...itemsRef.current].slice(0, max);
    setItems(itemsRef.current);
    if (follow && viewRef.current && !paused) {
      try { viewRef.current.scrollTop = viewRef.current.scrollHeight; } catch(_) {}
    }
    if (persist) {
      try { localStorage.setItem(storageKey, JSON.stringify(itemsRef.current.map(i => ({...i, ts:i.ts.toISOString?i.ts.toISOString():i.ts })))) } catch (_) {}
    }
  };

  // Load persisted logs on mount
  React.useEffect(() => {
    if (!persist) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        const parsed = Array.isArray(arr) ? arr.map(i => ({...i, ts: i.ts ? new Date(i.ts) : new Date()})) : [];
        itemsRef.current = parsed.slice(0, max);
        setItems(itemsRef.current);
      }
    } catch (_) {}
  // run once per connectionId or persist switch
  }, [storageKey]);

  React.useEffect(() => {
    const onWs = (e) => {
      const msg = e.detail || {};
      try {
        if (msg.type === 'log') {
          const d = msg.data || {};
          if (!connectionId || d.connectionId === connectionId) {
            pushed({
              ts: new Date(),
              kind: d.type || 'info',
              message: d.message || '',
              code: d.code || null,
              hint: d.hint || null
            });
          }
        } else if (msg.type === 'connection_status') {
          const d = msg.data || {};
          if (!connectionId || d.connectionId === connectionId) {
            pushed({ ts: new Date(), kind: 'status', message: `Status: ${d.status}` });
          }
        } else if (msg.type === 'ws' && msg.data && msg.data.event === 'message') {
          if (!connectionId || msg.data.connectionId === connectionId) {
            const includeResp = (()=>{ try { return localStorage.getItem('unicon_log_include_resp') !== '0'; } catch { return true; } })();
            const hintLimit = (()=>{ try { const n = parseInt(localStorage.getItem('unicon_log_hint_limit')||'800',10); return isNaN(n)?800:Math.min(5000,Math.max(100,n)); } catch { return 800; } })();
            const payload = typeof msg.data.data === 'string' ? msg.data.data : JSON.stringify(msg.data.data);
            pushed({ ts: new Date(), kind: 'ws_recv', message: 'WS message received', hint: includeResp ? String(payload).slice(0, hintLimit) : null });
          }
        }
      } catch (_) {}
    };
    window.addEventListener('unicon-ws', onWs);

    const onApp = (e) => {
      const d = e.detail || {};
      if (connectionId && d.connectionId && d.connectionId !== connectionId) return;
      pushed({ ts: d.ts ? new Date(d.ts) : new Date(), kind: d.kind || 'info', message: d.message || '', code: d.code || null, hint: d.hint || null });
    };
    window.addEventListener('unicon-log', onApp);

    const onTogglePause = () => { setPaused(p => { const v = !p; try { localStorage.setItem('unicon_log_paused', v ? '1' : '0'); } catch(_){}; return v; }); };
    const onToggleFollow = () => { setFollow(f => { const v = !f; try { localStorage.setItem('unicon_log_follow', v ? '1' : '0'); } catch(_){}; return v; }); };
    window.addEventListener('unicon-log-toggle-pause', onTogglePause);
    window.addEventListener('unicon-log-toggle-follow', onToggleFollow);

    let onError, onRej;
    if (includeBrowser) {
      onError = (e) => {
        pushed({ ts: new Date(), kind: 'browser', message: (e?.message || 'Script error') });
      };
      onRej = (e) => {
        const msg = (e?.reason && (e.reason.message || e.reason.toString())) || 'Unhandled promise rejection';
        pushed({ ts: new Date(), kind: 'browser', message: msg });
      };
      window.addEventListener('error', onError);
      window.addEventListener('unhandledrejection', onRej);
    }

    return () => {
      window.removeEventListener('unicon-ws', onWs);
      window.removeEventListener('unicon-log', onApp);
      window.removeEventListener('unicon-log-toggle-pause', onTogglePause);
      window.removeEventListener('unicon-log-toggle-follow', onToggleFollow);
      if (includeBrowser) {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRej);
      }
    };
  }, [connectionId, includeBrowser, max]);

  const clear = () => { itemsRef.current = []; setItems([]); if (persist) { try { localStorage.removeItem(storageKey); } catch(_){} } };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(items.map(i => ({ ts: i.ts.toISOString(), kind: i.kind, message: i.message, code: i.code, hint: i.hint })), null, 2));
    } catch (_) {}
  };

  const exportFile = (ndjson=false) => {
    const data = items.map(i => ({ ts: i.ts.toISOString(), kind: i.kind, message: i.message, code: i.code, hint: i.hint }));
    const text = ndjson ? data.map(x => JSON.stringify(x)).join('\n') : JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ndjson ? 'log.ndjson' : 'log.json';
    a.click(); URL.revokeObjectURL(a.href);
  };

  const level = (()=>{ try { return localStorage.getItem('unicon_log_level') || 'all'; } catch { return 'all'; } })();
  const passLevel = (k) => level==='all' ? true : (k==='error');
  const shown = items.filter(i => (filterKind==='all' || i.kind===filterKind) && passLevel(i.kind) && (!search || ((i.message||'') + ' ' + (i.hint||'')).toLowerCase().includes(search.toLowerCase())));

  const exportReport = () => {
    const report = {
      ts: new Date().toISOString(),
      connectionId: connectionId || null,
      page: typeof location !== 'undefined' ? location.href : null,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      settings: {
        persist,
        follow,
        paused,
        includePayloads: (()=>{ try { return localStorage.getItem('unicon_log_include_payload') !== '0'; } catch { return true; } })(),
        includeBodies: (()=>{ try { return localStorage.getItem('unicon_log_include_resp') !== '0'; } catch { return true; } })()
      },
      entries: items.map(i => ({ ts: i.ts.toISOString(), kind: i.kind, message: i.message, code: i.code || null, hint: i.hint || null }))
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'unicon-report.json'; a.click(); URL.revokeObjectURL(a.href);
  };

  // Hotkeys: P toggles pause, F toggles follow (ignore when focused on inputs)
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.isComposing) return;
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault(); setPaused(v => { const nv = !v; try { localStorage.setItem('unicon_log_paused', nv?'1':'0'); } catch(_){}; return nv; });
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault(); setFollow(v => { const nv = !v; try { localStorage.setItem('unicon_log_follow', nv?'1':'0'); } catch(_){}; return nv; });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`border rounded-lg p-3 bg-gray-50 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">Client log</div>
          <select className="border rounded px-1.5 py-0.5 text-xs" value={filterKind} onChange={e=>setFilterKind(e.target.value)}>
            {['all','info','status','error','browser','request','response','sql','sql_result','ws_sent','ws_recv'].map(k=> <option key={k} value={k}>{k}</option>)}
          </select>
          <label className="text-xs inline-flex items-center gap-1">
            Level
            <select className="border rounded px-1 py-0.5 text-xs" value={level} onChange={e=>{ try { localStorage.setItem('unicon_log_level', e.target.value); } catch(_){}; setFilterKind(prev=>prev); }}>
              <option value="all">all</option>
              <option value="errors">errors</option>
            </select>
          </label>
          <input className="border rounded px-1.5 py-0.5 text-xs" placeholder="search" value={search} onChange={e=>setSearch(e.target.value)} />
          <label className="text-xs inline-flex items-center gap-1">
            <input type="checkbox" checked={(()=>{ try { return localStorage.getItem('unicon_log_include_resp') !== '0'; } catch { return true; } })()} onChange={e=>{ try { localStorage.setItem('unicon_log_include_resp', e.target.checked ? '1' : '0'); } catch(_){} }} />
            Resp bodies
          </label>
          <label className="text-xs inline-flex items-center gap-1">
            <input type="checkbox" checked={(()=>{ try { return localStorage.getItem('unicon_log_include_payload') !== '0'; } catch { return true; } })()} onChange={e=>{ try { localStorage.setItem('unicon_log_include_payload', e.target.checked ? '1' : '0'); } catch(_){} }} />
            Payloads
          </label>
          <label className="text-xs inline-flex items-center gap-1">
            Preview
            <input type="number" min="100" max="5000" step="100" className="w-20 border rounded px-1 py-0.5 text-xs" defaultValue={(()=>{ try { return localStorage.getItem('unicon_log_hint_limit') || '800'; } catch { return '800'; } })()} onChange={e=>{ try { const v = Math.min(5000, Math.max(100, parseInt(e.target.value||'800',10))); localStorage.setItem('unicon_log_hint_limit', String(v)); } catch(_){} }} />
          </label>
          <label className="text-xs inline-flex items-center gap-1">
            <input type="checkbox" checked={persist} onChange={e=>{ const v=e.target.checked; setPersist(v); try { localStorage.setItem('unicon_log_persist', v ? '1':'0'); if (!v) localStorage.removeItem(storageKey); } catch(_){} }} />
            Persist
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button className="px-2 py-1 border rounded bg-white" onClick={()=>setPaused(v=>{ const nv=!v; try{localStorage.setItem('unicon_log_paused', nv?'1':'0');}catch(_){}; return nv; })}>{paused ? 'Resume' : 'Pause'}</button>
          <button className="px-2 py-1 border rounded bg-white" onClick={()=>setFollow(v=>{ const nv=!v; try{localStorage.setItem('unicon_log_follow', nv?'1':'0');}catch(_){}; return nv; })}>{follow ? 'Unfollow' : 'Follow'}</button>
          <button className="px-2 py-1 border rounded bg-white" onClick={()=>exportFile(false)} title="Download JSON">Export</button>
          <button className="px-2 py-1 border rounded bg-white" onClick={()=>exportFile(true)} title="Download NDJSON">NDJSON</button>
          <button className="px-2 py-1 border rounded bg-white" onClick={exportReport} title="Create report JSON">Report</button>
          <button className="px-2 py-1 border rounded bg-white" onClick={copy}><Copy size={12} className="inline mr-1"/>Copy</button>
          <button className="px-2 py-1 border rounded bg-white text-red-600" onClick={clear}><Trash2 size={12} className="inline mr-1"/>Clear</button>
        </div>
      </div>
      <div ref={viewRef} className="space-y-1 max-h-40 overflow-y-auto text-sm">
        {shown.length === 0 ? (
          <div className="text-xs text-gray-500">No log entries yet. Actions and errors will appear here.</div>
        ) : (
          shown.map((it, idx) => (
            <div key={idx} className="flex items-start justify-between bg-white rounded border px-2 py-1">
              <div>
                <div className={`text-xs inline-block mr-2 px-1 rounded ${
                  it.kind === 'error' ? 'bg-red-100 text-red-700' :
                  it.kind === 'status' ? 'bg-blue-100 text-blue-700' :
                  it.kind === 'browser' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{it.kind}</div>
                <span className="text-sm">{it.message}</span>
                {it.code && <span className="ml-2 text-[10px] text-gray-500">[{it.code}]</span>}
                {it.hint && <span className="ml-2 text-[10px] text-gray-500">— {it.hint}</span>}
              </div>
              <div className="text-xs text-gray-500 inline-flex items-center"><Clock size={12} className="mr-1"/>{it.ts.toLocaleTimeString()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}