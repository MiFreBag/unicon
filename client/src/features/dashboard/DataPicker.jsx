import React, { useEffect, useState } from 'react';
import { listConnections, op } from '../../lib/api';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#c026d3'];

export default function DataPicker({ open, onClose, onAdd }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [kind, setKind] = useState('auto');
  // REST fields
  const [endpoint, setEndpoint] = useState('/metrics');
  const [rootPath, setRootPath] = useState('');
  const [timePath, setTimePath] = useState('ts');
  const [valuePath, setValuePath] = useState('value');
  const [unitPath, setUnitPath] = useState('unit');
  // SQL fields
  const [sql, setSql] = useState('SELECT ts, value, unit FROM readings ORDER BY ts DESC LIMIT 200');
  const [timeField, setTimeField] = useState('ts');
  const [valueField, setValueField] = useState('value');
  const [unitField, setUnitField] = useState('unit');
  // OPC UA fields
  const [nodeId, setNodeId] = useState('');
  const [opcUnit, setOpcUnit] = useState('');
  // WebSocket fields
  const [wsValuePath, setWsValuePath] = useState('value');
  const [wsTimePath, setWsTimePath] = useState('ts');
  const [wsUnitPath, setWsUnitPath] = useState('unit');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listConnections().then(r => setConnections(r.connections || [])).finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const conn = connections.find(c => c.id === selectedId);
  const connType = (conn?.type || '').toLowerCase();
  const effectiveKind = kind === 'auto'
    ? (connType === 'sql' ? 'sql' : connType === 'opcua' || connType === 'opc-ua' ? 'opcua' : connType === 'websocket' || connType === 'ws' ? 'ws' : 'rest')
    : kind;

  const save = () => {
    if (!conn) return;
    let fetchConfig;
    if (effectiveKind === 'sql') {
      fetchConfig = { kind: 'sql', sql, timeField, valueField, unitField };
    } else if (effectiveKind === 'opcua') {
      fetchConfig = { kind: 'opcua', nodeId };
    } else if (effectiveKind === 'ws') {
      fetchConfig = { kind: 'ws', valuePath: wsValuePath, timePath: wsTimePath, unitPath: wsUnitPath };
    } else {
      fetchConfig = { kind: 'rest', method: 'GET', endpoint, rootPath, timePath, valuePath, unitPath };
    }
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      connectionId: conn.id,
      type: connType,
      label: label || `${conn.name}`,
      color,
      unit: effectiveKind === 'opcua' ? opcUnit : undefined,
      fetch: fetchConfig
    };
    onAdd?.(item);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-lg w-full max-w-2xl">
        <div className="p-4 border-b font-semibold">Add data series</div>
        <div className="p-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Connection</label>
              <select className="w-full border rounded px-2 py-1.5" value={selectedId} onChange={e=> setSelectedId(e.target.value)}>
                <option value="">Pick…</option>
                {connections.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.type})</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Label</label>
              <input className="w-full border rounded px-2 py-1.5" value={label} onChange={e=> setLabel(e.target.value)} placeholder="Series label" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Color</label>
              <div className="flex items-center gap-2">
                {COLORS.map(c => (
                  <button key={c} className={`w-6 h-6 rounded ${color===c ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`} style={{ background: c }} onClick={()=> setColor(c)} />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Provider</label>
              <select className="w-full border rounded px-2 py-1.5" value={kind} onChange={e=> setKind(e.target.value)}>
                <option value="auto">Auto ({connType || '—'})</option>
                <option value="rest">REST (polling)</option>
                <option value="sql">SQL (polling)</option>
                <option value="opcua">OPC UA (live streaming)</option>
                <option value="ws">WebSocket (live streaming)</option>
              </select>
            </div>
          </div>

          {effectiveKind === 'rest' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Endpoint</label>
                  <input className="w-full border rounded px-2 py-1.5" value={endpoint} onChange={e=> setEndpoint(e.target.value)} placeholder="/metrics" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Root path (optional)</label>
                  <input className="w-full border rounded px-2 py-1.5" value={rootPath} onChange={e=> setRootPath(e.target.value)} placeholder="data.items" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Time field path</label>
                  <input className="w-full border rounded px-2 py-1.5" value={timePath} onChange={e=> setTimePath(e.target.value)} placeholder="ts" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Value field path</label>
                  <input className="w-full border rounded px-2 py-1.5" value={valuePath} onChange={e=> setValuePath(e.target.value)} placeholder="value" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit field path</label>
                  <input className="w-full border rounded px-2 py-1.5" value={unitPath} onChange={e=> setUnitPath(e.target.value)} placeholder="unit" />
                </div>
              </div>
            </div>
          )}

          {effectiveKind === 'sql' && (
            <div className="space-y-2">
              <label className="block text-xs text-gray-600 mb-1">SQL</label>
              <textarea rows={5} className="w-full border rounded px-2 py-1.5 font-mono text-xs" value={sql} onChange={e=> setSql(e.target.value)} />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Time column</label>
                  <input className="w-full border rounded px-2 py-1.5" value={timeField} onChange={e=> setTimeField(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Value column</label>
                  <input className="w-full border rounded px-2 py-1.5" value={valueField} onChange={e=> setValueField(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit column (optional)</label>
                  <input className="w-full border rounded px-2 py-1.5" value={unitField} onChange={e=> setUnitField(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {effectiveKind === 'opcua' && (
            <div className="space-y-2">
              <div className="text-xs text-amber-600 mb-2">OPC UA live streaming: data comes via WebSocket broadcast when you have a monitored subscription active on this connection.</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Node ID</label>
                  <input className="w-full border rounded px-2 py-1.5 font-mono" value={nodeId} onChange={e=> setNodeId(e.target.value)} placeholder="ns=2;s=Temperature" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit (optional)</label>
                  <input className="w-full border rounded px-2 py-1.5" value={opcUnit} onChange={e=> setOpcUnit(e.target.value)} placeholder="°C" />
                </div>
              </div>
            </div>
          )}

          {effectiveKind === 'ws' && (
            <div className="space-y-2">
              <div className="text-xs text-amber-600 mb-2">WebSocket live streaming: data comes via incoming WS messages. Specify JSON paths for value, time, and unit in each message.</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Value path</label>
                  <input className="w-full border rounded px-2 py-1.5" value={wsValuePath} onChange={e=> setWsValuePath(e.target.value)} placeholder="value" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Time path</label>
                  <input className="w-full border rounded px-2 py-1.5" value={wsTimePath} onChange={e=> setWsTimePath(e.target.value)} placeholder="ts" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Unit path (optional)</label>
                  <input className="w-full border rounded px-2 py-1.5" value={wsUnitPath} onChange={e=> setWsUnitPath(e.target.value)} placeholder="unit" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button className="px-3 py-1.5 border rounded" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1.5 border rounded bg-blue-600 text-white" disabled={!selectedId} onClick={save}>Add</button>
        </div>
      </div>
    </div>
  );
}