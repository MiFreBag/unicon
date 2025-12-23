// client/src/app/AppProviders.jsx
import React from 'react';

export default function AppProviders({ children }) {
  // Set up a shared WebSocket to receive backend broadcasts and fan-out via CustomEvent
  React.useEffect(() => {
    let ws;
    let closed = false;
    const connect = () => {
      // Prefer same-origin /ws (Vite proxy in dev), else env URL, else localhost:8080
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const sameOrigin = `${proto}://${location.host}/ws`;
      const envUrl = import.meta?.env?.VITE_WS_URL;
      const port = import.meta?.env?.VITE_WS_PORT || 8080;
      const fallback = `ws://localhost:${port}`;
      const wsUrl = envUrl || sameOrigin || fallback;
      try {
        ws = new WebSocket(wsUrl);
      } catch (_) {
        // Try fallback if construction failed
        try { ws = new WebSocket(fallback); } catch (_) { /* ignore */ }
      }
      if (!ws) return;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          window.dispatchEvent(new CustomEvent('unicon-ws', { detail: msg }));
        } catch (_) {}
      };
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        try { ws.close(); } catch (_) {}
      };
    };
    connect();
    return () => { closed = true; try { ws && ws.close(); } catch (_) {} };
  }, []);
  // Placeholder for future contexts (AppState, Tabs, Theme, etc.)
  return children;
}
