// client/src/components/BackendStatus.jsx
import React from 'react';

export default function BackendStatus() {
  const [ws, setWs] = React.useState({ connected: false, paused: false });
  const [apiOk, setApiOk] = React.useState(true);
  const [last, setLast] = React.useState(null);
  const [now, setNow] = React.useState(Date.now());
  const [paused, setPaused] = React.useState(() => { try { return localStorage.getItem('unicon_ws_paused') === '1'; } catch { return false; } });

  React.useEffect(() => {
    const onWs = (e) => setWs(e.detail || { connected: false });
    window.addEventListener('unicon-ws-status', onWs);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { window.removeEventListener('unicon-ws-status', onWs); clearInterval(tick); };
  }, []);

  React.useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/unicon/api/health');
        setApiOk(res.ok);
        setLast(new Date());
      } catch (_) {
        setApiOk(false);
        setLast(new Date());
      }
    };
    check();
    const id = setInterval(check, 10000);
    return () => { clearInterval(id); };
  }, []);

  if (ws.connected && apiOk && !paused) return null;

  const secondsToRetry = ws.nextRetryTs && !paused ? Math.max(0, Math.ceil((ws.nextRetryTs - now) / 1000)) : null;

  const retryNow = () => { if (!paused) window.dispatchEvent(new CustomEvent('unicon-ws-reconnect')); };
  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    try { localStorage.setItem('unicon_ws_paused', next ? '1' : '0'); } catch {}
    window.dispatchEvent(new CustomEvent('unicon-ws-toggle-pause', { detail: { paused: next } }));
  };
  const copyDiag = async () => {
    const payload = {
      apiOk,
      wsConnected: ws.connected,
      wsPaused: paused,
      wsError: !!ws.error,
      wsUrl: ws.url || null,
      nextRetryTs: ws.nextRetryTs || null,
      page: typeof location !== 'undefined' ? location.href : null,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      lastHealthCheck: last ? last.toISOString() : null,
      ts: new Date().toISOString()
    };
    try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); } catch(_){ /* ignore */ }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm px-4 py-2 flex items-center gap-3">
      <span className="inline-flex w-2.5 h-2.5 rounded-full bg-amber-500" />
      <span className="flex-1">
        Backend: {apiOk ? 'API OK' : 'API unreachable'} · WS {paused ? 'paused' : (ws.connected ? 'connected' : 'disconnected')}
        {!paused && secondsToRetry !== null ? ` · auto-retry in ${secondsToRetry}s` : ''}
        {last ? ` · checked ${last.toLocaleTimeString()}` : ''}
      </span>
      <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50" onClick={togglePause}>{paused ? 'Resume WS' : 'Pause WS'}</button>
      <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50" onClick={retryNow} disabled={paused} title={paused? 'Resume first to reconnect':'Reconnect WebSocket'}>Retry</button>
      <button className="px-2 py-1 border rounded bg-white hover:bg-gray-50" onClick={copyDiag}>Copy diagnostics</button>
    </div>
  );
}
