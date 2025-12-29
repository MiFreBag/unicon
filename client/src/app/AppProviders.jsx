// client/src/app/AppProviders.jsx
import React from 'react';

export default function AppProviders({ children }) {
  // Set up a shared WebSocket to receive backend broadcasts and fan-out via CustomEvent
  React.useEffect(() => {
    let ws;
    let closed = false;
    let timerId = null;
    const pausedRef = { current: false };

    // initialize paused state from localStorage
    try { pausedRef.current = localStorage.getItem('unicon_ws_paused') === '1'; } catch (_) {}

    const connect = () => {
      if (pausedRef.current) {
        // reflect paused status to UI and do not connect
        window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: false, paused: true } }));
        return;
      }
      // Prefer same-origin /ws (Vite proxy in dev), else env URL, else localhost:8080
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const sameOrigin = `${proto}://${location.host}/ws`;
      const envUrl = import.meta?.env?.VITE_WS_URL;
      const port = import.meta?.env?.VITE_WS_PORT || 8080;
      const fallback = `ws://localhost:${port}`;
      // Prefer same-origin so Vite can proxy wss->ws in dev; allow override via VITE_WS_URL
      const wsUrl = envUrl || sameOrigin;
      try {
        ws = new WebSocket(wsUrl);
      } catch (_) {
        // Try fallback if construction failed
        try { ws = new WebSocket(fallback); } catch (_) { /* ignore */ }
      }
      if (!ws) return;
      ws.onopen = () => {
        window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: true, url: ws.url, paused: false } }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          window.dispatchEvent(new CustomEvent('unicon-ws', { detail: msg }));
        } catch (_) {}
      };
      ws.onclose = () => {
        const nextRetryTs = Date.now() + 1500;
        window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: false, url: ws.url, nextRetryTs, paused: pausedRef.current } }));
        if (!closed && !pausedRef.current) timerId = setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        const nextRetryTs = Date.now() + 1500;
        window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: false, error: true, url: ws?.url, nextRetryTs, paused: pausedRef.current } }));
        try { ws.close(); } catch (_) {}
      };
    };

    const onForceReconnect = () => {
      if (pausedRef.current) return; // ignore manual reconnect while paused
      try { if (timerId) { clearTimeout(timerId); timerId = null; } } catch(_) {}
      try { ws && ws.close(); } catch(_) {}
      connect();
    };

    const onTogglePause = (e) => {
      const wantPaused = !!(e?.detail && e.detail.paused);
      pausedRef.current = wantPaused;
      try { localStorage.setItem('unicon_ws_paused', wantPaused ? '1' : '0'); } catch(_) {}
      if (wantPaused) {
        // stop timers and close socket
        try { if (timerId) { clearTimeout(timerId); timerId = null; } } catch(_) {}
        try { ws && ws.close(); } catch(_) {}
        window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: false, paused: true } }));
      } else {
        // resume
        connect();
      }
    };

    window.addEventListener('unicon-ws-reconnect', onForceReconnect);
    window.addEventListener('unicon-ws-toggle-pause', onTogglePause);
    connect();
    return () => {
      closed = true;
      window.removeEventListener('unicon-ws-reconnect', onForceReconnect);
      window.removeEventListener('unicon-ws-toggle-pause', onTogglePause);
      try { ws && ws.close(); } catch (_) {}
      try { if (timerId) clearTimeout(timerId); } catch(_) {}
    };
  }, []);
  // Placeholder for future contexts (AppState, Tabs, Theme, etc.)
  return children;
}
