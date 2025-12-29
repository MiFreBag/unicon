import React, { useState } from 'react';
import yaml from 'js-yaml';

export default function FormatTools() {
  const [jsonIn, setJsonIn] = useState('{"hello":"world"}');
  const [jsonOut, setJsonOut] = useState('');
  const [yamlIn, setYamlIn] = useState('hello: world');
  const [yamlOut, setYamlOut] = useState('');
  const [yamlValid, setYamlValid] = useState(null);
  const [b64in, setB64in] = useState('hello');
  const [b64out, setB64out] = useState('');
  const [urlIn, setUrlIn] = useState('hello world');
  const [urlOut, setUrlOut] = useState('');
  const [jwtIn, setJwtIn] = useState('');
  const [jwtOut, setJwtOut] = useState('');

  function formatJson() {
    try { setJsonOut(JSON.stringify(JSON.parse(jsonIn), null, 2)); }
    catch (e) { setJsonOut('Error: '+e.message); }
  }
  function minifyJson() {
    try { setJsonOut(JSON.stringify(JSON.parse(jsonIn))); }
    catch (e) { setJsonOut('Error: '+e.message); }
  }
  function yamlToJson() {
    try { setJsonOut(JSON.stringify(yaml.load(yamlIn), null, 2)); }
    catch (e) { setJsonOut('Error: '+e.message); }
  }
  function jsonToYaml() {
    try { setYamlOut(yaml.dump(JSON.parse(jsonIn), { lineWidth: 120 })); }
    catch (e) { setYamlOut('Error: '+e.message); }
  }
  function validateYaml() {
    try { yaml.load(yamlIn); setYamlValid(true); }
    catch (e) { setYamlValid(false); setYamlOut('Error: '+e.message); }
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-medium">JSON / YAML Tools</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm">JSON</label>
            <div className="space-x-2">
              <button className="px-2 py-1 border rounded text-xs" onClick={formatJson}>Format</button>
              <button className="px-2 py-1 border rounded text-xs" onClick={minifyJson}>Minify</button>
              <button className="px-2 py-1 border rounded text-xs" onClick={jsonToYaml}>To YAML</button>
            </div>
          </div>
          <textarea className="w-full h-56 border rounded p-2 font-mono text-sm" value={jsonIn} onChange={e=>setJsonIn(e.target.value)} />
          <pre className="w-full h-56 border rounded p-2 font-mono text-xs bg-gray-50 overflow-auto whitespace-pre-wrap mt-2">{jsonOut}</pre>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm">YAML</label>
            <div className="space-x-2">
              <button className="px-2 py-1 border rounded text-xs" onClick={validateYaml}>Validate</button>
              <button className="px-2 py-1 border rounded text-xs" onClick={yamlToJson}>To JSON</button>
            </div>
          </div>
          <textarea className="w-full h-56 border rounded p-2 font-mono text-sm" value={yamlIn} onChange={e=>setYamlIn(e.target.value)} />
          <div className="text-xs mt-1">{yamlValid===true && <span className="text-green-600">Valid YAML</span>}{yamlValid===false && <span className="text-red-600">Invalid YAML</span>}</div>
          <pre className="w-full h-56 border rounded p-2 font-mono text-xs bg-gray-50 overflow-auto whitespace-pre-wrap mt-2">{yamlOut}</pre>
        </div>
      </div>
      <div className="pt-2 border-t" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="font-medium mb-2">Base64</h4>
          <div className="flex gap-2 mb-2">
            <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ try{ setB64out(btoa(b64in)); }catch(e){ setB64out('Error: '+e.message);} }}>Encode</button>
            <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ try{ setB64out(atob(b64in)); }catch(e){ setB64out('Error: '+e.message);} }}>Decode</button>
          </div>
          <textarea className="w-full h-24 border rounded p-2 font-mono text-sm" value={b64in} onChange={e=>setB64in(e.target.value)} />
          <pre className="w-full h-24 border rounded p-2 font-mono text-xs bg-gray-50 overflow-auto whitespace-pre-wrap mt-2">{b64out}</pre>
        </div>
        <div>
          <h4 className="font-medium mb-2">URL Encode/Decode</h4>
          <div className="flex gap-2 mb-2">
            <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ try{ setUrlOut(encodeURIComponent(urlIn)); }catch(e){ setUrlOut('Error: '+e.message);} }}>Encode</button>
            <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ try{ setUrlOut(decodeURIComponent(urlIn)); }catch(e){ setUrlOut('Error: '+e.message);} }}>Decode</button>
          </div>
          <textarea className="w-full h-24 border rounded p-2 font-mono text-sm" value={urlIn} onChange={e=>setUrlIn(e.target.value)} />
          <pre className="w-full h-24 border rounded p-2 font-mono text-xs bg-gray-50 overflow-auto whitespace-pre-wrap mt-2">{urlOut}</pre>
        </div>
      </div>

      <div className="pt-2 border-t" />
      <h4 className="font-medium mb-2">JWT Decode (no verification)</h4>
      <textarea className="w-full h-20 border rounded p-2 font-mono text-sm" value={jwtIn} onChange={e=>setJwtIn(e.target.value)} placeholder="header.payload.signature" />
      <div className="mt-2">
        <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ try{ const parts=jwtIn.split('.'); const b64u=(s)=>s.replace(/-/g,'+').replace(/_/g,'/'); const pad=(s)=>s+"===".slice((s.length+3)%4); const dec=(s)=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(pad(b64u(s))), c=>c.charCodeAt(0)))); setJwtOut(JSON.stringify({ header:dec(parts[0]), payload:dec(parts[1]) }, null, 2)); }catch(e){ setJwtOut('Error: '+e.message);} }}>Decode</button>
      </div>
      <pre className="w-full h-40 border rounded p-2 font-mono text-xs bg-gray-50 overflow-auto whitespace-pre-wrap mt-2">{jwtOut}</pre>
    </div>
  );
}
