// client/src/ui/ConnectionBadge.jsx
import React from 'react';

function StatusDot({ status = 'disconnected' }) {
  const color = status === 'connected' ? 'bg-green-500' : status === 'connecting' ? 'bg-amber-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-300';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} aria-hidden="true"/>;
}

export default function ConnectionBadge({
  connection,
  name,
  type,
  status,
  id,
  className = ''
}) {
  const c = connection || {};
  const label = name || c.name || 'No connection selected';
  const t = type || c.type;
  const s = status || c.status || (label === 'No connection selected' ? 'disconnected' : undefined);
  const shortId = (id || c.id) ? String(id || c.id).slice(0, 8) : null;
  const isEmpty = label === 'No connection selected';

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${isEmpty ? 'text-gray-500 border-gray-200 bg-gray-50' : 'text-gray-700 border-gray-200 bg-white'} ${className}`} role="status" aria-label="Connection in use">
      {!isEmpty && <StatusDot status={s} />}
      <span className="font-medium">{label}</span>
      {t ? <span className="uppercase text-[10px] tracking-wide text-gray-500">{t}</span> : null}
      {shortId ? <span className="font-mono text-gray-400">#{shortId}</span> : null}
      {s ? <span className={`ml-1 px-1.5 py-0.5 rounded ${s==='connected' ? 'bg-green-50 text-green-700' : s==='connecting' ? 'bg-amber-50 text-amber-700' : s==='error' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>{s}</span> : null}
    </div>
  );
}
