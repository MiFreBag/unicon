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
        window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: false, paused: true } }));
        return;
      }
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const sameOrigin = `${proto}://${location.host}/ws`;
      const envUrl = import.meta?.env?.VITE_WS_URL || null;
      const port = import.meta?.env?.VITE_WS_PORT || 8080;
      const fallbackLocalhost = `${proto}://localhost:${port}`;
      const fallback127 = `${proto}://127.0.0.1:${port}`;
      const hostBased = `${proto}://${location.hostname}:${port}`;
      const candidates = [envUrl, sameOrigin, hostBased, fallbackLocalhost, fallback127].filter(Boolean);
      let idx = 0;
      const tryNext = () => {
        if (idx >= candidates.length) {
          const nextRetryTs = Date.now() + 1500;
          window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: false, nextRetryTs, paused: pausedRef.current } }));
          if (!closed && !pausedRef.current) timerId = setTimeout(connect, 1500);
          return;
        }
        const url = candidates[idx++];
        try { ws = new WebSocket(url); } catch { return tryNext(); }
        let opened = false;
        const openTimer = setTimeout(() => { if (!opened) { try { ws.close(); } catch {} } }, 800);
        ws.onopen = () => {
          opened = true; clearTimeout(openTimer);
          window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: true, url: ws.url, paused: false } }));
        };
        ws.onmessage = (ev) => {
          try { const msg = JSON.parse(ev.data); window.dispatchEvent(new CustomEvent('unicon-ws', { detail: msg })); } catch {}
        };
        ws.onclose = () => {
          if (!opened) return tryNext();
          const nextRetryTs = Date.now() + 1500;
          window.dispatchEvent(new CustomEvent('unicon-ws-status', { detail: { connected: false, url: ws.url, nextRetryTs, paused: pausedRef.current } }));
          if (!closed && !pausedRef.current) timerId = setTimeout(connect, 1500);
        };
        ws.onerror = () => {
          try { ws.close(); } catch {}
        };
      };
      tryNext();
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
