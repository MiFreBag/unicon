import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  Trash2, 
  Copy, 
  Eye,
  EyeOff,
  RefreshCw,
  Globe,
  Clock,
  Upload,
  Link as LinkIcon,
  Download,
  CornerDownRight
} from 'lucide-react';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';

const RestWorkspace = ({ connection }) => {
  const [activeTab, setActiveTab] = useState('request');
  const [request, setRequest] = useState({
    method: 'GET',
    endpoint: '/',
    headers: {},
    body: '',
    params: {}
  });
  const [response, setResponse] = useState(null);
  const [requestHistory, setRequestHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customHeaders, setCustomHeaders] = useState([{ key: '', value: '' }]);
  const [showRawResponse, setShowRawResponse] = useState(false);

  // OpenAPI + Schema state
  const [openApiUrl, setOpenApiUrl] = useState('');
  const [endpoints, setEndpoints] = useState([]); // [{ method, path, summary }]
  const [specStatus, setSpecStatus] = useState('idle'); // idle|loading|loaded|error
  const [schemaPreview, setSchemaPreview] = useState('');

  // Post actions
  const [postActions, setPostActions] = useState([]); // [{ type: 'download' } | { type: 'followup', method, endpoint }]

  const API_BASE = '/unicon/api';

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  async function loadOpenApiFromUrl() {
    if (!openApiUrl) return;
    if (!connection || connection.status !== 'connected') {
      alert('Nicht mit Server verbunden');
      return;
    }
    setSpecStatus('loading');
    try {
      // Tell handler to load from URL
      const res = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'loadOpenApi',
          params: { openApiUrl }
        })
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || 'Load failed');
      await refreshEndpoints();
      setSpecStatus('loaded');
    } catch (e) {
      console.error(e);
      setSpecStatus('error');
      alert(e.message || 'Load failed');
    }
  }

  async function uploadOpenApiFile(file) {
    if (!file) return;
    if (!connection || connection.status !== 'connected') { alert('Nicht mit Server verbunden'); return; }
    setSpecStatus('loading');
    try {
      const fd = new FormData();
      fd.append('openApiFile', file);
      const up = await fetch(`${API_BASE}/upload-openapi`, { method: 'POST', body: fd });
      const upData = await up.json();
      if (!up.ok || upData?.success === false) throw new Error(upData?.error || 'Upload failed');
      // Instruct handler to load the uploaded file by name
      const res = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id, operation: 'loadOpenApi', params: { openApiFile: upData.filename || file.name } })
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || 'Load failed');
      await refreshEndpoints();
      setSpecStatus('loaded');
    } catch (e) {
      console.error(e);
      setSpecStatus('error');
      alert(e.message || 'Upload failed');
    }
  }

  async function refreshEndpoints(tag=null) {
    if (!connection || connection.status !== 'connected') return;
    try {
      const res = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id, operation: 'getEndpoints', params: { tag } })
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.data?.endpoints)) {
        setEndpoints(data.data.endpoints);
      }
    } catch (_) {}
  }

  function generateExampleFromSchema(schema, depth=0) {
    if (!schema || depth>6) return null;
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
    const t = schema.type;
    if (t === 'object' || (schema.properties && !t)) {
      const obj = {};
      const props = schema.properties || {};
      for (const k of Object.keys(props)) obj[k] = generateExampleFromSchema(props[k], depth+1);
      return obj;
    }
    if (t === 'array' || schema.items) {
      return [generateExampleFromSchema(schema.items || {}, depth+1)];
    }
    if (t === 'string') return (schema.enum?.[0]) || 'string';
    if (t === 'number' || t === 'integer') return 0;
    if (t === 'boolean') return true;
    return null;
  }

  const sendRequest = async () => {
    if (!connection || connection.status !== 'connected') {
      alert('Nicht mit Server verbunden');
      return;
    }

    setIsLoading(true);
    setResponse(null);

    try {
      // Build headers from custom headers array
      const headers = {};
      customHeaders.forEach(header => {
        if (header.key && header.value) {
          headers[header.key] = header.value;
        }
      });

      const requestData = {
        connectionId: connection.id,
        operation: 'request',
        params: {
          method: request.method,
          endpoint: request.endpoint,
          data: request.body ? JSON.parse(request.body) : null,
          headers
        }
      };

      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      
      if (result.success) {
        const responseData = {
          ...result.data,
          timestamp: new Date().toISOString(),
          request: { ...request, headers }
        };
        
        setResponse(responseData);
        
        // Add to history
        setRequestHistory(prev => [responseData, ...prev.slice(0, 49)]); // Keep last 50

        // Run post actions (best-effort)
        for (const act of postActions) {
          try {
            if (act.type === 'download') {
              const blob = new Blob([JSON.stringify(responseData.data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = act.filename || 'response.json';
              document.body.appendChild(a); a.click(); a.remove();
            } else if (act.type === 'followup') {
              const fr = await fetch(`${API_BASE}/operation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  connectionId: connection.id,
                  operation: 'request',
                  params: { method: act.method || 'GET', endpoint: act.endpoint || '/', data: null, headers: {} }
                })
              });
              // ignore output; this is fire-and-forget for now
              await fr.json().catch(()=>({}));
            }
          } catch (_) {}
        }
      } else {
        throw new Error(result.error || 'Request failed');
      }
    } catch (error) {
      console.error('Request error:', error);
      setResponse({
        status: 0,
        statusText: 'Error',
        data: { error: error.message },
        timestamp: new Date().toISOString(),
        request: { ...request }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addCustomHeader = () => {
    setCustomHeaders(prev => [...prev, { key: '', value: '' }]);
  };

  const updateCustomHeader = (index, field, value) => {
    setCustomHeaders(prev => prev.map((header, i) => 
      i === index ? { ...header, [field]: value } : header
    ));
  };

  const removeCustomHeader = (index) => {
    setCustomHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const loadFromHistory = (historyItem) => {
    setRequest(historyItem.request);
    const headers = Object.entries(historyItem.request.headers || {});
    setCustomHeaders(headers.length > 0 ? headers.map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }]);
  };

  const formatJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-100';
    if (status >= 300 && status < 400) return 'text-blue-600 bg-blue-100';
    if (status >= 400 && status < 500) return 'text-orange-600 bg-orange-100';
    if (status >= 500) return 'text-red-600 bg-red-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Connection in use */}
      <div className="mb-3"><ConnectionBadge connection={connection} /></div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {['request', 'response', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'request' && 'Request'}
              {tab === 'response' && 'Response'}
              {tab === 'history' && `History (${requestHistory.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Request Tab */}
      {activeTab === 'request' && (
        <div className="flex-1 space-y-6">
          {/* OpenAPI / Schema helpers */}
          <div className="bg-gray-50 border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Upload size={14} />
              <div className="text-sm font-medium">OpenAPI / Swagger</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm">Upload:</label>
              <input type="file" accept=".json,.yaml,.yml" onChange={(e)=> e.target.files?.[0] && uploadOpenApiFile(e.target.files[0])} />
              <span className="text-xs text-gray-500">{specStatus==='loaded' ? 'Spec loaded' : specStatus==='loading' ? 'Loading…' : ''}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <LinkIcon size={14} />
              <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="https://host/openapi.json" value={openApiUrl} onChange={e=>setOpenApiUrl(e.target.value)} />
              <Button size="sm" onClick={loadOpenApiFromUrl}>Load</Button>
              <Button size="sm" variant="secondary" onClick={()=>refreshEndpoints()}>Refresh endpoints</Button>
            </div>
            {endpoints.length > 0 && (
              <div className="mt-2 max-h-40 overflow-auto border rounded">
                {endpoints.map((ep, i) => (
                  <button key={i} className="w-full text-left px-2 py-1 hover:bg-gray-100 text-sm flex items-center gap-2" title={ep.summary||''} onClick={()=>{ setRequest(prev=>({ ...prev, method: ep.method, endpoint: ep.path })); setActiveTab('request'); }}>
                    <span className="px-1 py-0.5 rounded text-[11px] font-mono bg-gray-200">{ep.method}</span>
                    <span className="font-mono text-[12px]">{ep.path}</span>
                    {ep.summary && <span className="text-xs text-gray-500">— {ep.summary}</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Upload size={14} />
              <div className="text-sm font-medium">JSON Schema → Body</div>
              <input type="file" accept=".json" onChange={async (e)=>{
                const f = e.target.files?.[0]; if (!f) return; try { const txt = await f.text(); const obj = JSON.parse(txt); const sample = generateExampleFromSchema(obj); setSchemaPreview(JSON.stringify(sample, null, 2)); } catch (er) { alert('Invalid JSON schema'); }
              }} />
              {schemaPreview && <Button size="sm" onClick={()=> setRequest(prev=>({ ...prev, method: ['POST','PUT','PATCH'].includes(prev.method)?prev.method:'POST', body: schemaPreview }))}>Insert to body</Button>}
            </div>
            {schemaPreview && (
              <pre className="mt-2 bg-gray-900 text-green-400 p-2 rounded text-xs max-h-40 overflow-auto">{schemaPreview}</pre>
            )}
          </div>

          {/* Request Line */}
          <div className="flex space-x-3 mt-4">
            <Select value={request.method} onChange={(e)=>setRequest(prev=>({...prev, method: e.target.value}))} className="w-32" aria-label="HTTP Method">
              {httpMethods.map(m => (<option key={m} value={m}>{m}</option>))}
            </Select>
            <Input
              value={request.endpoint}
              onChange={(e)=>setRequest(prev=>({...prev, endpoint: e.target.value}))}
              placeholder="/api/endpoint"
              aria-label="Endpoint"
              className="flex-1"
            />
            <Button onClick={sendRequest} disabled={isLoading || connection?.status !== 'connected'} leftEl={isLoading ? <span className="mr-2"><span className="sr-only">Loading</span></span> : <Send size={16} className="mr-2"/>}>
              Send
            </Button>
          </div>

          {/* Headers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Headers</h4>
              <Button variant="secondary" size="sm" onClick={addCustomHeader} leftEl={<Plus size={14} className="mr-1"/>}>
                Add Header
              </Button>
            </div>
            <div className="space-y-2">
              {customHeaders.map((header, index) => (
                <div key={index} className="flex space-x-2">
                  <Input value={header.key} onChange={(e)=>updateCustomHeader(index,'key',e.target.value)} placeholder="Header Name" className="flex-1" />
                  <Input value={header.value} onChange={(e)=>updateCustomHeader(index,'value',e.target.value)} placeholder="Header Value" className="flex-1" />
                  <button
                    onClick={() => removeCustomHeader(index)}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Request Body */}
          {['POST', 'PUT', 'PATCH'].includes(request.method) && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Request Body</h4>
              <textarea
                value={request.body}
                onChange={(e)=>setRequest(prev=>({...prev, body: e.target.value}))}
                placeholder='{"key": "value"}'
                rows={8}
                className="w-full px-3 py-2 border border-swarco-grey-400 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-swarco-blue-200 focus:border-swarco-blue-600"
              />
              <div className="text-xs text-gray-500">
                JSON format expected. Will be parsed automatically.
              </div>
            </div>
          )}
          {/* Post actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Post actions</h4>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={()=> setPostActions(prev => [...prev, { type: 'download', filename: 'response.json' }])} leftEl={<Download size={14} className="mr-1"/>}>Save as file</Button>
                <Button size="sm" variant="secondary" onClick={()=> setPostActions(prev => [...prev, { type: 'followup', method: 'GET', endpoint: '/' }])} leftEl={<CornerDownRight size={14} className="mr-1"/>}>Add follow-up</Button>
              </div>
            </div>
            {postActions.length>0 && (
              <div className="space-y-1">
                {postActions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{a.type}</span>
                    {a.type==='download' && (
                      <input className="border rounded px-2 py-1 text-xs" placeholder="filename" value={a.filename||''} onChange={e=> setPostActions(p=> p.map((x,j)=> j===i?{...x, filename:e.target.value}:x))} />
                    )}
                    {a.type==='followup' && (
                      <>
                        <select className="border rounded px-2 py-1 text-xs" value={a.method} onChange={e=> setPostActions(p=> p.map((x,j)=> j===i?{...x, method:e.target.value}:x))}>
                          {httpMethods.map(m=> <option key={m} value={m}>{m}</option>)}
                        </select>
                        <input className="border rounded px-2 py-1 text-xs flex-1" placeholder="/path" value={a.endpoint} onChange={e=> setPostActions(p=> p.map((x,j)=> j===i?{...x, endpoint:e.target.value}:x))} />
                      </>
                    )}
                    <button className="text-gray-400 hover:text-red-500" onClick={()=> setPostActions(p => p.filter((_,j)=> j!==i))}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Response Tab */}
      {activeTab === 'response' && (
        <div className="flex-1">
          {response ? (
            <div className="space-y-6">
              {/* Response Header */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Response Info</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowRawResponse(!showRawResponse)}
                      className="inline-flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                    >
                      {showRawResponse ? <EyeOff size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />}
                      {showRawResponse ? 'Formatted' : 'Raw'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(formatJson(response.data))}
                      className="inline-flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                    >
                      <Copy size={12} className="mr-1" />
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-mono ${getStatusColor(response.status)}`}>
                      {response.status} {response.statusText}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Time:</span>
                    <span className="ml-2 font-mono">{new Date(response.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <span className="ml-2 font-mono">{JSON.stringify(response.data).length} bytes</span>
                  </div>
                </div>
              </div>

              {/* Response Headers */}
              {response.headers && Object.keys(response.headers).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Response Headers</h4>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="space-y-1 text-sm font-mono">
                      {Object.entries(response.headers).map(([key, value]) => (
                        <div key={key} className="flex">
                          <span className="text-gray-600 w-32 flex-shrink-0">{key}:</span>
                          <span className="text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Response Body */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Response Body</h4>
                <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm overflow-auto max-h-96">
                  {showRawResponse ? (
                    <pre>{JSON.stringify(response.data)}</pre>
                  ) : (
                    <pre>{formatJson(response.data)}</pre>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Globe size={48} className="mx-auto mb-4 opacity-50" />
                <p>Keine Response verfügbar</p>
                <p className="text-sm">Senden Sie zuerst einen Request</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="flex-1">
          {requestHistory.length > 0 ? (
            <div className="space-y-3">
              {requestHistory.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                     onClick={() => loadFromHistory(item)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="px-2 py-1 text-xs font-mono bg-gray-100 rounded">
                        {item.request.method}
                      </span>
                      <span className="font-mono text-sm text-gray-700">
                        {item.request.endpoint}
                      </span>
                      <span className={`px-2 py-1 text-xs font-mono rounded ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Clock size={12} />
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {Object.keys(item.request.headers || {}).length > 0 && (
                      <span className="mr-3">{Object.keys(item.request.headers).length} headers</span>
                    )}
                    {item.request.body && (
                      <span>Body: {item.request.body.slice(0, 50)}...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Clock size={48} className="mx-auto mb-4 opacity-50" />
                <p>Keine Request History</p>
                <p className="text-sm">Ihre Requests werden hier angezeigt</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RestWorkspace;