import { useEffect, useRef, useState, useCallback } from 'react';
import { op } from '../../lib/api';

function get(obj, path) {
  if (!path) return obj;
  return String(path).split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

const MAX_LIVE_POINTS = 500; // keep rolling window for live streams

export function useSeriesFetcher(items, refreshMs = 5000) {
  const [series, setSeries] = useState([]);
  const timer = useRef(null);
  const liveBuffers = useRef(new Map()); // id -> { points: [], unit }

  // Merge live streaming points into series state
  const mergeLive = useCallback((id, pt, unit) => {
    liveBuffers.current.set(id, liveBuffers.current.get(id) || { points: [], unit });
    const buf = liveBuffers.current.get(id);
    buf.points.push(pt);
    if (buf.points.length > MAX_LIVE_POINTS) buf.points.shift();
    if (unit) buf.unit = unit;
  }, []);

  // Listen for OPC UA and WS live events
  useEffect(() => {
    const liveItems = items.filter(it => it.fetch?.kind === 'opcua' || it.fetch?.kind === 'ws');
    if (!liveItems.length) return;

    const handler = (e) => {
      const msg = e.detail;
      // OPC UA data event
      if (msg?.type === 'opcua' && msg?.data?.event === 'data') {
        const { connectionId, nodeId, value, ts } = msg.data;
        liveItems.forEach(it => {
          if (it.fetch?.kind === 'opcua' && it.connectionId === connectionId && it.fetch?.nodeId === nodeId) {
            const timestamp = ts ? new Date(ts).getTime() : Date.now();
            mergeLive(it.id, { ts: timestamp, value: Number(value) }, it.unit);
          }
        });
      }
      // WebSocket message event
      if (msg?.type === 'ws' && msg?.data?.event === 'message') {
        const { connectionId, data: payload } = msg.data;
        liveItems.forEach(it => {
          if (it.fetch?.kind === 'ws' && it.connectionId === connectionId) {
            try {
              const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
              const val = get(parsed, it.fetch?.valuePath);
              const ts = get(parsed, it.fetch?.timePath);
              const unit = get(parsed, it.fetch?.unitPath);
              if (val !== undefined) {
                mergeLive(it.id, { ts: ts ? new Date(ts).getTime() : Date.now(), value: Number(val) }, unit || it.unit);
              }
            } catch {}
          }
        });
      }
    };
    window.addEventListener('unicon-ws', handler);
    return () => window.removeEventListener('unicon-ws', handler);
  }, [items, mergeLive]);

  const loadOnce = async () => {
    const results = await Promise.all(items.map(async (it) => {
      try {
        // Live streaming sources: use buffered points
        if (it.fetch?.kind === 'opcua' || it.fetch?.kind === 'ws') {
          const buf = liveBuffers.current.get(it.id) || { points: [], unit: it.unit };
          return { id: it.id, label: it.label, color: it.color, points: buf.points.slice(), unit: buf.unit || it.unit };
        }
        if (it.fetch?.kind === 'sql') {
          const res = await op(it.connectionId, 'query', { sql: it.fetch.sql, params: [] });
          const rows = res?.rows || res?.data?.rows || res?.data || res || [];
          const points = rows.map(r => ({ ts: new Date(r[it.fetch.timeField]).getTime(), value: Number(r[it.fetch.valueField]) }))
            .filter(p => !Number.isNaN(p.value) && Number.isFinite(p.ts));
          const unit = rows.find(r => r[it.fetch.unitField])?.[it.fetch.unitField];
          return { id: it.id, label: it.label, color: it.color, points, unit: unit || it.unit };
        }
        // default: REST
        const res = await op(it.connectionId, 'request', { method: it.fetch?.method || 'GET', endpoint: it.fetch?.endpoint || '/' });
        let data = res?.data ?? res;
        if (Array.isArray(data)) {
          // ok
        } else {
          data = get(data, it.fetch?.rootPath) || [];
        }
        if (!Array.isArray(data)) data = [];
        const points = data.map(row => ({ ts: new Date(get(row, it.fetch?.timePath)).getTime(), value: Number(get(row, it.fetch?.valuePath)) }))
          .filter(p => !Number.isNaN(p.value) && Number.isFinite(p.ts));
        const unit = data.find(r => get(r, it.fetch?.unitPath)) ? get(data.find(r => get(r, it.fetch?.unitPath)), it.fetch?.unitPath) : undefined;
        return { id: it.id, label: it.label, color: it.color, points, unit: unit || it.unit };
      } catch (e) {
        return { id: it.id, label: it.label, color: it.color, points: [], unit: it.unit, error: e?.message || 'error' };
      }
    }));
    setSeries(results);
  };

  useEffect(() => {
    if (!items?.length) { setSeries([]); liveBuffers.current.clear(); return; }
    loadOnce();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(loadOnce, Math.max(1000, refreshMs));
    return () => { if (timer.current) clearInterval(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items), refreshMs]);

  return series;
}
