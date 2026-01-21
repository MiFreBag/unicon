// client/src/components/ConnectionLog.jsx
import React from 'react';
import { Clock, Trash2, Copy } from 'lucide-react';

export default function ConnectionLog({ connectionId, includeBrowser = true, max = 200, className = '' }) {
  const [items, setItems] = React.useState([]);
  const itemsRef = React.useRef([]);
  const pushed = (entry) => {
    itemsRef.current = [entry, ...itemsRef.current].slice(0, max);
    setItems(itemsRef.current);
  };

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
        }
      } catch (_) {}
    };
    window.addEventListener('unicon-ws', onWs);

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
      if (includeBrowser) {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onRej);
      }
    };
  }, [connectionId, includeBrowser, max]);

  const clear = () => { itemsRef.current = []; setItems([]); };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(items.map(i => ({ ts: i.ts.toISOString(), kind: i.kind, message: i.message, code: i.code, hint: i.hint })), null, 2));
    } catch (_) {}
  };

  return (
    <div className={`border rounded-lg p-3 bg-gray-50 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Client log</div>
        <div className="flex items-center gap-2 text-xs">
          <button className="px-2 py-1 border rounded bg-white" onClick={copy}><Copy size={12} className="inline mr-1"/>Copy</button>
          <button className="px-2 py-1 border rounded bg-white text-red-600" onClick={clear}><Trash2 size={12} className="inline mr-1"/>Clear</button>
        </div>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto text-sm">
        {items.length === 0 ? (
          <div className="text-xs text-gray-500">No log entries yet. Actions and errors will appear here.</div>
        ) : (
          items.map((it, idx) => (
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