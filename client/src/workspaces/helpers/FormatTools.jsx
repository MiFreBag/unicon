import React, { useState } from 'react';
import yaml from 'js-yaml';

export default function FormatTools() {
  const [jsonIn, setJsonIn] = useState('{"hello":"world"}');
  const [jsonOut, setJsonOut] = useState('');
  const [yamlIn, setYamlIn] = useState('hello: world');
  const [yamlOut, setYamlOut] = useState('');
  const [yamlValid, setYamlValid] = useState(null);

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
    </div>
  );
}