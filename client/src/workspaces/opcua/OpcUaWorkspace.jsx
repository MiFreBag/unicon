// client/src/workspaces/opcua/OpcUaWorkspace.jsx
import React, { useEffect, useState } from 'react';
import { RefreshCw, Settings, Database, Play, Square } from 'lucide-react';
import Button from '../../ui/Button.jsx';
import Input from '../../ui/Input.jsx';
import ConnectionBadge from '../../ui/ConnectionBadge.jsx';
import ConnectionLog from '../../components/ConnectionLog.jsx';
import { connectConnection, disconnectConnection, op } from '../../lib/api';

export default function OpcUaWorkspace({ connection }) {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeValue, setNodeValue] = useState('');
  const [dataType, setDataType] = useState('Auto'); // Auto, Boolean, Int32, Float, Double, String, JSON
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(connection?.status || 'disconnected');

  useEffect(() => { setStatus(connection?.status || 'disconnected'); }, [connection?.status]);

  const onConnect = async () => {
    if (!connection?.id) return;
    setIsLoading(true);
    try {
      await connectConnection(connection.id);
      setStatus('connected');
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'status', message:'connected' } })); } catch(_){}
      await browseNodes(true);
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'error', message:`OPC UA connect failed: ${e.message}` } })); } catch(_){}
      alert(e.message || 'Connect failed');
    } finally { setIsLoading(false); }
  };

  const onDisconnect = async () => {
    if (!connection?.id) return;
    setIsLoading(true);
    try {
      await disconnectConnection(connection.id);
      setStatus('disconnected');
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'status', message:'disconnected' } })); } catch(_){}
      setNodes([]); setSelectedNode(null);
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'error', message:`OPC UA disconnect failed: ${e.message}` } })); } catch(_){}
      alert(e.message || 'Disconnect failed');
    } finally { setIsLoading(false); }
  };

  const browseNodes = async (force=false) => {
    if (!connection || (!force && status !== 'connected')) return;
    setIsLoading(true);
    try {
      const response = await fetch('/unicon/api/operation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id, operation: 'browse', params: { nodeId: 'RootFolder' } })
      });
      const result = await response.json();
      if (result.success) setNodes(result.nodes || []);
    } finally { setIsLoading(false); }
  };

  const onRead = async () => {
    if (!connection?.id || !selectedNode) return;
    setIsLoading(true);
    try {
      const r = await op(connection.id, 'read', { nodes: [{ nodeId: selectedNode.nodeId }] });
      const data = r?.data || r;
      const v = Array.isArray(data?.values) ? data.values[0] : (data?.value ?? null);
      setNodeValue(v == null ? '' : String(v));
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'info', message:`Read ${selectedNode.nodeId}`, hint: String(v).slice(0, 800) } })); } catch(_){}
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'error', message:`OPC UA read failed: ${e.message}` } })); } catch(_){}
      alert(e.message || 'Read failed');
    } finally { setIsLoading(false); }
  };

  const coerceValue = (text, kind) => {
    const t = (kind||'Auto').toLowerCase();
    if (t === 'auto') {
      // try JSON, number, boolean, else string
      try { return JSON.parse(text); } catch {}
      if (/^true|false$/i.test(text)) return /^true$/i.test(text);
      const n = Number(text); if (!Number.isNaN(n)) return n;
      return text;
    }
    if (t === 'json') { try { return JSON.parse(text); } catch { return text; } }
    if (t === 'boolean') return /^true$/i.test(text);
    if (t === 'int32') return parseInt(text, 10);
    if (t === 'float' || t === 'double') return parseFloat(text);
    return text; // string or unknown kinds
  };

  const onWrite = async () => {
    if (!connection?.id || !selectedNode) return;
    const value = coerceValue(nodeValue, dataType);
    setIsLoading(true);
    try {
      const r = await op(connection.id, 'write', { nodeId: selectedNode.nodeId, value, dataType: dataType==='Auto' ? undefined : dataType });
      const ok = r?.success || r?.statusCode === 'Good' || r?.statusCode === 0;
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind: ok ? 'info' : 'error', message:`Write ${selectedNode.nodeId}`, hint: JSON.stringify({ value, dataType }).slice(0,800) } })); } catch(_){}
      if (!ok) alert('Write may have failed');
    } catch (e) {
      try { window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'error', message:`OPC UA write failed: ${e.message}` } })); } catch(_){}
      alert(e.message || 'Write failed');
    } finally { setIsLoading(false); }
  };

  useEffect(() => { if (status === 'connected') browseNodes(); }, [status]);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">OPC UA Browser</h3>
        <div className="flex items-center gap-3">
          <ConnectionBadge connection={connection} status={status} />
          <Button variant="secondary" onClick={onConnect} disabled={status==='connected' || isLoading} leftEl={<Play size={16} className="mr-2" />}>Connect</Button>
          <Button variant="secondary" onClick={onDisconnect} disabled={status!=='connected' || isLoading} leftEl={<Square size={16} className="mr-2" />}>Disconnect</Button>
          <Button variant="secondary" onClick={()=>browseNodes()} disabled={isLoading || status!=='connected'} leftEl={<RefreshCw size={16} className={isLoading ? 'mr-2 animate-spin' : 'mr-2'} />}>Refresh</Button>
        </div>
      </div>
      <ConnectionLog connectionId={connection?.id} />
      <div className="flex-1 grid grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <h4 className="font-medium mb-3">Nodes</h4>
          {nodes.length ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {nodes.map((node) => (
                <div key={node.nodeId} onClick={() => { setSelectedNode(node); setNodeValue(node.value || ''); }}
                     className={`p-2 rounded cursor-pointer hover:bg-gray-50 ${selectedNode?.nodeId === node.nodeId ? 'bg-blue-50 border border-blue-200' : ''}`}>
                  <div className="font-medium text-sm">{node.displayName}</div>
                  <div className="text-xs text-gray-500">{node.nodeId}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Database size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">{status==='connected' ? 'No nodes available' : 'Not connected'}</p>
            </div>
          )}
        </div>
        <div className="border rounded p-4">
          <h4 className="font-medium mb-3">Node Operations</h4>
          {selectedNode ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Node ID</label>
                <Input value={selectedNode.nodeId} readOnly className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Value</label>
                <Input value={nodeValue} onChange={(e)=>setNodeValue(e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Type</label>
                <select className="border rounded px-2 py-1 text-sm" value={dataType} onChange={e=>setDataType(e.target.value)}>
                  {['Auto','Boolean','Int32','Float','Double','String','JSON'].map(dt => <option key={dt} value={dt}>{dt}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={onRead} disabled={status!=='connected' || isLoading}>Read</Button>
                <Button className="flex-1" onClick={onWrite} disabled={status!=='connected' || isLoading}>Write</Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Settings size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select a node to perform operations</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
  );
}
