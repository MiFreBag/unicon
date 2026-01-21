// client/src/workspaces/opcua/OpcUaWorkspace.jsx
import React, { useEffect, useState, useRef } from 'react';
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

  // Saved nodes (persist per connection)
  const storageKeySaved = React.useMemo(() => `opcua_saved_nodes_${connection?.id || 'global'}`,[connection?.id]);
  const storageKeySeq = React.useMemo(() => `opcua_seq_${connection?.id || 'global'}`,[connection?.id]);
  const [saved, setSaved] = useState(()=>{ try { return JSON.parse(localStorage.getItem(storageKeySaved)||'[]'); } catch { return []; } });
  const [seq, setSeq] = useState(()=>{ try { return JSON.parse(localStorage.getItem(storageKeySeq)||'[]'); } catch { return []; } });
  const [running, setRunning] = useState(false);
  const runIdRef = useRef(null);
  const [repeatCount, setRepeatCount] = useState(1);
  const [loop, setLoop] = useState(false);
  const [startAt, setStartAt] = useState(''); // ISO local datetime (from input)
  const importRef = useRef(null);
  const [batchRows, setBatchRows] = useState([]);
  const [selectedSaved, setSelectedSaved] = useState(()=> new Set());
  const [runSelectedOnly, setRunSelectedOnly] = useState(false);

  useEffect(() => { setStatus(connection?.status || 'disconnected'); }, [connection?.status]);
  useEffect(() => { try { localStorage.setItem(storageKeySaved, JSON.stringify(saved)); } catch(_){} }, [saved, storageKeySaved]);
  useEffect(() => { try { localStorage.setItem(storageKeySeq, JSON.stringify(seq)); } catch(_){} }, [seq, storageKeySeq]);

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

  const addSaved = () => {
    if (!selectedNode) { alert('Select a node first'); return; }
    const label = prompt('Label (optional):', selectedNode.displayName || selectedNode.nodeId) || '';
    const next = { nodeId: selectedNode.nodeId, label: label.trim(), displayName: selectedNode.displayName || '' };
    if (saved.some(s => s.nodeId === next.nodeId)) return;
    setSaved(prev => [...prev, next]);
  };
  const removeSaved = (nodeId) => setSaved(prev => prev.filter(s => s.nodeId !== nodeId));

  const addStep = (preset) => {
    const nodeId = preset?.nodeId || selectedNode?.nodeId || saved[0]?.nodeId || '';
    if (!nodeId) { alert('Add or select a node first'); return; }
    setSeq(prev => [...prev, { nodeId, selected: false, dataType: 'Auto', value: '', delayMs: 1000, durationMs: 0, jitterMs: 0, revert: false, description: '' }]);
  };
  const updateStep = (i, field, value) => setSeq(prev => prev.map((s,idx)=> idx===i?{...s,[field]:value}:s));
  const removeStep = (i) => setSeq(prev => prev.filter((_,idx)=>idx!==i));

  const stopSequence = () => { runIdRef.current = null; setRunning(false); };
  const sleep = (ms) => new Promise(r=>setTimeout(r, ms));
  const toStartTs = () => {
    if (!startAt) return null;
    try { const d = new Date(startAt); return isNaN(d.getTime()) ? null : d.getTime(); } catch { return null; }
  };
  const [pauseBetweenRepeats, setPauseBetweenRepeats] = useState(0);

  const runSequence = async () => {
    if (!connection?.id) return;
    if (!seq.length) { alert('No steps'); return; }
    if (status !== 'connected') { alert('Connect first'); return; }
    const steps = runSelectedOnly ? seq.filter(s=>s.selected) : seq;
    if (!steps.length) { alert('No steps selected'); return; }
    const runId = Date.now(); runIdRef.current = runId; setRunning(true);
    // Wait until start time if set
    const ts = toStartTs();
    if (ts && ts > Date.now()) {
      const wait = ts - Date.now();
      window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'info', message:`Sequence starts in ${wait} ms` } }));
      await sleep(wait);
      if (runIdRef.current !== runId) { setRunning(false); return; }
    }
    let iter = 0;
    while (runIdRef.current === runId && (loop || iter < Math.max(1, parseInt(repeatCount||1,10)))) {
      for (let i=0; i<steps.length; i++) {
        if (runIdRef.current !== runId) break;
        const step = steps[i];
        const jitter = Math.max(0, parseInt(step.jitterMs||0,10));
        const delay = Math.max(0, parseInt(step.delayMs||0,10) + (jitter? (Math.floor(Math.random()*((jitter*2)+1))-jitter) : 0));
        if (delay>0) await sleep(delay);
        if (runIdRef.current !== runId) break;
        try {
          // optional read-before for revert
          let prev = undefined;
          if (step.revert && parseInt(step.durationMs||0,10) > 0) {
            const rd = await op(connection.id, 'read', { nodes: [{ nodeId: step.nodeId }] });
            const dv = rd?.data || rd; const vals = dv?.values || [];
            prev = Array.isArray(vals) ? vals[0]?.value ?? vals[0] : dv?.value;
          }
          const value = coerceValue(String(step.value ?? ''), step.dataType||'Auto');
          const wr = await op(connection.id, 'write', { nodeId: step.nodeId, value, dataType: step.dataType==='Auto'?undefined:step.dataType });
          const ok = wr?.success || wr?.statusCode === 'Good' || wr?.statusCode === 0;
          window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind: ok?'info':'error', message:`Seq write ${step.nodeId}`, hint: JSON.stringify({ value, dataType: step.dataType }).slice(0,800) } }));
          const hold = Math.max(0, parseInt(step.durationMs||0,10));
          if (hold>0) await sleep(hold);
          if (step.revert && prev !== undefined && runIdRef.current === runId) {
            try {
              await op(connection.id, 'write', { nodeId: step.nodeId, value: prev, dataType: undefined });
              window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'info', message:`Reverted ${step.nodeId}`, hint: String(prev).slice(0,800) } }));
            } catch(e) {
              window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'error', message:`Revert failed: ${e.message}` } }));
            }
          }
        } catch (e) {
          window.dispatchEvent(new CustomEvent('unicon-log', { detail: { connectionId: connection.id, kind:'error', message:`Seq step failed: ${e.message}` } }));
        }
      }
      iter++;
      if (!loop && iter >= Math.max(1, parseInt(repeatCount||1,10))) break;
      const pauseMs = parseInt(pauseBetweenRepeats||0,10);
      if (pauseMs>0 && runIdRef.current === runId) await sleep(pauseMs);
    }
    if (runIdRef.current === runId) setRunning(false);
  };

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

        {/* Saved nodes */}
        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Saved Nodes</h4>
            <div className="text-xs text-gray-500">{saved.length}</div>
          </div>
          {saved.length ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {saved.map(s => (
                <div key={s.nodeId} className="border rounded p-2 text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedSaved.has(s.nodeId)} onChange={(e)=>{ setSelectedSaved(prev=>{ const next=new Set(prev); if(e.target.checked) next.add(s.nodeId); else next.delete(s.nodeId); return next; }); }} />
                    <div>
                      <div className="font-medium">{s.label || s.displayName || s.nodeId}</div>
                      <div className="text-xs text-gray-500 font-mono">{s.nodeId}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>setSelectedNode({ nodeId: s.nodeId, displayName: s.label || s.displayName || s.nodeId })}>Use</button>
                    <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>removeSaved(s.nodeId)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No saved nodes yet.</div>
          )}
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button className="px-2 py-1 border rounded" onClick={()=>{
              const list = Array.from(selectedSaved);
              if (!list.length) { alert('Select nodes first'); return; }
              setSeq(prev => [...prev, ...list.map(n => ({ nodeId:n, dataType:'Auto', value:'', delayMs:1000 }))]);
            }}>Add selected to sequence</button>
            <button className="px-2 py-1 border rounded" onClick={()=>setSelectedSaved(new Set())}>Clear selection</button>
          </div>
        </div>

        {/* Sequence builder */}
        <div className="border rounded p-4 col-span-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Write Sequence</h4>
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1">Start at
                <input type="datetime-local" className="border rounded px-2 py-1" value={startAt} onChange={e=>setStartAt(e.target.value)} />
              </label>
              <label className="flex items-center gap-1">Repeat
                <input type="number" min="1" className="border rounded px-2 py-1 w-20" value={repeatCount} onChange={e=>setRepeatCount(e.target.value)} />
              </label>
              <label className="flex items-center gap-1">Pause
                <input type="number" min="0" className="border rounded px-2 py-1 w-24" value={pauseBetweenRepeats} onChange={e=>setPauseBetweenRepeats(e.target.value)} /> ms
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={loop} onChange={e=>setLoop(e.target.checked)} /> Loop
              </label>
              <button className="px-2 py-1 border rounded" onClick={()=>addStep()}>Add step</button>
              <button className="px-2 py-1 border rounded" onClick={()=>{ try { const blob = new Blob([JSON.stringify(seq, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='opcua-sequence.json'; a.click(); URL.revokeObjectURL(a.href); } catch(e){ alert('Export failed'); } }}>Export</button>
              <button className="px-2 py-1 border rounded" onClick={()=>importRef.current?.click()}>Import</button>
              <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={async (e)=>{ const f=e.target.files?.[0]; if(!f) return; try { const txt=await f.text(); const arr=JSON.parse(txt); if(Array.isArray(arr)) setSeq(arr.map(x=>({ nodeId: String(x.nodeId||''), selected: !!x.selected, dataType: x.dataType||'Auto', value: x.value ?? '', delayMs: parseInt(x.delayMs||0,10), durationMs: parseInt(x.durationMs||0,10), jitterMs: parseInt(x.jitterMs||0,10), revert: !!x.revert, description: x.description||'' }))); } catch(err){ alert('Import failed: '+(err.message||'error')); } finally { e.target.value=''; } }} />
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={runSelectedOnly} onChange={e=>setRunSelectedOnly(e.target.checked)} /> Run selected only
              </label>
              <button className="px-2 py-1 border rounded" onClick={runSequence} disabled={running || status!=='connected'}>Run</button>
              <button className="px-2 py-1 border rounded" onClick={stopSequence} disabled={!running}>Stop</button>
            </div>
          </div>
          {seq.length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1">Sel</th>
                    <th className="text-left px-2 py-1">Node</th>
                    <th className="text-left px-2 py-1">Type</th>
                    <th className="text-left px-2 py-1">Value</th>
                    <th className="text-left px-2 py-1">Delay</th>
                    <th className="text-left px-2 py-1">Jitter</th>
                    <th className="text-left px-2 py-1">Hold</th>
                    <th className="text-left px-2 py-1">Revert</th>
                    <th className="text-left px-2 py-1">Desc</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {seq.map((st, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" checked={!!st.selected} onChange={e=>updateStep(i,'selected',e.target.checked)} />
                      </td>
                      <td className="px-2 py-1">
                        <select className="border rounded px-2 py-1 font-mono text-xs min-w-[280px]" value={st.nodeId} onChange={e=>updateStep(i,'nodeId',e.target.value)}>
                          {[...new Set([st.nodeId, selectedNode?.nodeId, ...saved.map(s=>s.nodeId)].filter(Boolean))].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select className="border rounded px-2 py-1" value={st.dataType||'Auto'} onChange={e=>updateStep(i,'dataType',e.target.value)}>
                          {['Auto','Boolean','Int32','Float','Double','String','JSON'].map(dt => <option key={dt} value={dt}>{dt}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input className="border rounded px-2 py-1 w-full font-mono text-xs" value={st.value||''} onChange={e=>updateStep(i,'value',e.target.value)} placeholder="value" />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="border rounded px-2 py-1 w-24" value={st.delayMs||0} onChange={e=>updateStep(i,'delayMs',e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="border rounded px-2 py-1 w-24" value={st.jitterMs||0} onChange={e=>updateStep(i,'jitterMs',e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="border rounded px-2 py-1 w-24" value={st.durationMs||0} onChange={e=>updateStep(i,'durationMs',e.target.value)} />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input type="checkbox" checked={!!st.revert} onChange={e=>updateStep(i,'revert',e.target.checked)} />
                      </td>
                      <td className="px-2 py-1">
                        <input className="border rounded px-2 py-1 w-full text-xs" value={st.description||''} onChange={e=>updateStep(i,'description',e.target.value)} placeholder="description" />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <button className="px-2 py-0.5 border rounded text-xs" onClick={()=>removeStep(i)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No steps. Add steps to build a write sequence.</div>
          )}

          {/* Timeline preview */}
          <div className="mt-3 text-xs text-gray-700">
            {(() => {
              if (!seq.length) return null;
              const base = (()=>{ try { const d=new Date(startAt); return isNaN(d.getTime())?new Date():d; } catch { return new Date(); } })();
              let t = base.getTime();
              const rows = seq.map((s, i) => { t += parseInt(s.delayMs||0,10); return { idx:i+1, at:new Date(t), nodeId:s.nodeId, desc:s.description||'' }; });
              const total = seq.reduce((sum,s)=> sum + parseInt(s.delayMs||0,10), 0);
              return (
                <div className="border rounded p-2 bg-gray-50">
                  <div className="mb-1">First run total time: {total} ms</div>
                  <div className="max-h-28 overflow-auto">
                    <table className="w-full">
                      <thead><tr><th className="text-left">#</th><th className="text-left">Time</th><th className="text-left">Node</th><th className="text-left">Desc</th></tr></thead>
                      <tbody>
                        {rows.map(r=> (
                          <tr key={r.idx}><td className="pr-2">{r.idx}</td><td className="pr-2">{r.at.toLocaleTimeString()}</td><td className="pr-2 font-mono">{r.nodeId}</td><td>{r.desc}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      <ConnectionLog connectionId={connection?.id} />
      <div className="flex-1 grid grid-cols-3 gap-4">
        <div className="border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Nodes</h4>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={addSaved} disabled={!selectedNode}>Add to Saved</Button>
            </div>
          </div>
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

        {/* Batch Read (Saved nodes) */}
        <div className="border rounded p-4 col-span-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">Batch Read (Saved Nodes)</h4>
            <div className="flex items-center gap-2 text-sm">
              <button className="px-2 py-1 border rounded" onClick={async()=>{
                const list = Array.from(selectedSaved);
                const targets = list.length ? saved.filter(s=>list.includes(s.nodeId)) : saved;
                if (!targets.length) { alert('No saved nodes'); return; }
                if (status !== 'connected') { alert('Connect first'); return; }
                try {
                  const r = await op(connection.id, 'read', { nodes: targets.map(s => ({ nodeId: s.nodeId })) });
                  const data = r?.data || r;
                  const values = data?.values || [];
                  const rows = targets.map((s, i) => ({ nodeId: s.nodeId, value: values[i]?.value ?? values[i] ?? null, statusCode: values[i]?.statusCode || 'Good' }));
                  setBatchRows(rows);
                } catch(e){ alert('Batch read failed: '+(e.message||'error')); }
              }}>Read All</button>
              <button className="px-2 py-1 border rounded" onClick={()=>{
                if (!batchRows.length) return;
                const cols = ['nodeId','value','statusCode'];
                const esc = v => {
                  const s = String(v ?? '');
                  return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
                };
                const lines = [cols.join(',')].concat(batchRows.map(r => cols.map(c=>esc(r[c])).join(',')));
                const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='opcua-batch.csv'; a.click(); URL.revokeObjectURL(a.href);
              }}>Export CSV</button>
              <button className="px-2 py-1 border rounded" onClick={()=>setBatchRows([])}>Clear</button>
            </div>
          </div>
          {batchRows.length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1">Node</th>
                    <th className="text-left px-2 py-1">Value</th>
                    <th className="text-left px-2 py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((r,i)=> (
                    <tr key={i} className="border-b">
                      <td className="px-2 py-1 font-mono text-xs">{r.nodeId}</td>
                      <td className="px-2 py-1 font-mono text-xs break-words">{String(r.value)}</td>
                      <td className="px-2 py-1 text-xs">{r.statusCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No results yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
