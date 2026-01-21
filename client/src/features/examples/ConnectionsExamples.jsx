import React, { useRef, useState } from 'react';
import { createConnection } from '../../lib/api';
import Spinner from '../../ui/Spinner.jsx';
import { EXAMPLE_PRESETS } from './presets.js';
import { getLibrary, saveTemplate, deleteTemplate, exportLibrary, importLibrary, serverList, serverAdd, serverDelete, serverImport } from './library.js';

const REST_EXAMPLES = EXAMPLE_PRESETS.rest || [
  {
    name: 'JSONPlaceholder',
    baseUrl: 'https://jsonplaceholder.typicode.com',
    tryPath: '/posts/1',
    description: 'Fake online REST API for testing and prototyping.'
  },
  {
    name: 'HTTPBin',
    baseUrl: 'https://httpbin.org',
    tryPath: '/get',
    description: 'HTTP request & response service with many endpoints.'
  },
  {
    name: 'Cat Facts',
    baseUrl: 'https://catfact.ninja',
    tryPath: '/fact',
    description: 'Random cat facts.'
  },
  {
    name: 'Dog CEO',
    baseUrl: 'https://dog.ceo',
    tryPath: '/api/breeds/image/random',
    description: 'Random dog images.'
  },
  {
    name: 'Bored API',
    baseUrl: 'https://www.boredapi.com',
    tryPath: '/api/activity',
    description: 'Random activities to beat boredom.'
  },
  {
    name: 'Advice Slip',
    baseUrl: 'https://api.adviceslip.com',
    tryPath: '/advice',
    description: 'Random life advice.'
  },
  {
    name: 'IPify',
    baseUrl: 'https://api.ipify.org',
    tryPath: '/?format=json',
    description: 'Returns your public IP in JSON.'
  },
  {
    name: 'Agify',
    baseUrl: 'https://api.agify.io',
    tryPath: '/?name=michael',
    description: 'Predict age by name.'
  }
];

const WS_EXAMPLES = EXAMPLE_PRESETS.ws || [
  {
    name: 'Public Echo',
    url: 'wss://echo.websocket.events',
    description: 'Simple echo server for quick WebSocket tests.'
  }
];

const SQL_EXAMPLES = EXAMPLE_PRESETS.sql || [
  {
    name: 'SQLite (in-memory)',
    config: { driver: 'sqlite', filename: ':memory:' },
    description: 'Temporary DB; perfect for a quick SELECT 1 test.'
  }
];

const OPCUA_EXAMPLES = EXAMPLE_PRESETS.opcua || [];

export default function ConnectionsExamples({ openTab }) {
  const [busy, setBusy] = useState(false);

  const addRest = async (ex) => {
    setBusy(true);
    try {
      const res = await createConnection({ name: `${ex.name} (REST)`, type: 'rest', config: { baseUrl: ex.baseUrl } });
      const conn = res.connection;
      openTab && openTab('rest', { connectionId: conn.id, connection: conn, title: `REST • ${ex.name}` });
    } finally { setBusy(false); }
  };

  const addWs = async (ex) => {
    setBusy(true);
    try {
      const res = await createConnection({ name: `${ex.name} (WS)`, type: 'websocket', config: { url: ex.url } });
      const conn = res.connection;
      openTab && openTab('ws', { connectionId: conn.id, connection: conn, title: `WebSocket • ${ex.name}` });
    } finally { setBusy(false); }
  };

  const addSql = async (ex) => {
    setBusy(true);
    try {
      const res = await createConnection({ name: `${ex.name}`, type: 'sql', config: ex.config });
      const conn = res.connection;
      openTab && openTab('sql', { connectionId: conn.id, connection: conn, title: `SQL • ${ex.name}` });
    } finally { setBusy(false); }
  };

  const [library, setLibrary] = useState(getLibrary());
  React.useEffect(() => { (async () => { try { const remote = await serverList(); setLibrary(remote); localStorage.setItem('unicon_templates_v1', JSON.stringify(remote)); } catch {} })(); }, []);
  const importRef = useRef(null);

  const addToLibrary = async (tmpl) => {
    try {
      await serverAdd(tmpl);
      const remote = await serverList();
      setLibrary(remote);
      localStorage.setItem('unicon_templates_v1', JSON.stringify(remote));
    } catch (_e) {
      // fallback local
      saveTemplate(tmpl);
      setLibrary(getLibrary());
    }
  };

  const createFromTemplate = async (tmpl) => {
    const payload = { name: tmpl.name, type: tmpl.type, config: tmpl.config };
    const res = await createConnection(payload);
    const conn = res.connection;
    const kindMap = { rest:'rest', websocket:'ws', sql:'sql', 'opc-ua':'opcua', opcua:'opcua' };
    const kind = kindMap[tmpl.type] || 'rest';
    openTab && openTab(kind, { connectionId: conn.id, connection: conn, title: `${tmpl.type.toUpperCase()} • ${tmpl.name}` });
  };

  const addOpc = async (ex) => {
    setBusy(true);
    try {
      const res = await createConnection({ name: `${ex.name} (OPC UA)`, type: 'opc-ua', config: { endpointUrl: ex.endpointUrl, securityPolicy: ex.securityPolicy||'None', securityMode: ex.securityMode||'None' } });
      const conn = res.connection;
      openTab && openTab('opcua', { connectionId: conn.id, connection: conn, title: `OPC UA • ${ex.name}` });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-xl font-semibold">Quick-start examples</h2>
        <p className="text-sm text-gray-600 mt-1">Curated, no-auth endpoints inspired by the community-maintained Public APIs list. Create a connection with one click and start testing.</p>
        <p className="text-xs text-gray-500 mt-1">Note: Third-party endpoints can go offline; if one fails, try another.</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">REST APIs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REST_EXAMPLES.map(ex => (
            <div key={ex.name} className="border rounded-lg p-4">
              <div className="font-medium">{ex.name}</div>
              <div className="text-xs text-gray-500 mt-1 break-all">{ex.baseUrl}{ex.tryPath}</div>
              <p className="text-sm text-gray-600 mt-2">{ex.description}</p>
              <div className="mt-3 flex gap-2">
                <button
                  className="px-3 py-1.5 text-sm rounded border"
                  onClick={() => addToLibrary({ name: ex.name, type: 'rest', config: { baseUrl: ex.baseUrl } })}
                >Save to My Library</button>
                <button disabled={busy} onClick={() => addRest(ex)} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">Add & open</button>
                <a className="px-3 py-1.5 text-sm rounded border text-blue-700" href={`${ex.baseUrl}${ex.tryPath}`} target="_blank" rel="noreferrer">Try GET</a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">WebSocket</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WS_EXAMPLES.map(ex => (
            <div key={ex.name} className="border rounded-lg p-4">
              <div className="font-medium">{ex.name}</div>
              <div className="text-xs text-gray-500 mt-1 break-all">{ex.url}</div>
              <p className="text-sm text-gray-600 mt-2">{ex.description}</p>
              <div className="mt-3 flex gap-2">
                <button disabled={busy} onClick={() => addWs(ex)} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">Add & open</button>
                <button className="px-3 py-1.5 text-sm rounded border" onClick={() => addToLibrary({ name: ex.name, type: 'websocket', config: { url: ex.url } })}>Save to My Library</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">OPC UA</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OPCUA_EXAMPLES.map(ex => (
            <div key={ex.name} className="border rounded-lg p-4">
              <div className="font-medium">{ex.name}</div>
              <div className="text-xs text-gray-500 mt-1 break-all">{ex.endpointUrl}</div>
              <p className="text-sm text-gray-600 mt-2">{ex.description}</p>
              <div className="mt-3 flex gap-2">
                <button disabled={busy} onClick={() => addOpc(ex)} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">Add & open</button>
                <button className="px-3 py-1.5 text-sm rounded border" onClick={() => addToLibrary({ name: ex.name, type: 'opc-ua', config: { endpointUrl: ex.endpointUrl, securityPolicy: ex.securityPolicy||'None', securityMode: ex.securityMode||'None' } })}>Save to My Library</button>
              </div>
              <div className="text-xs text-amber-600 mt-2">Public demo endpoints can be unstable.</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">SQL</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SQL_EXAMPLES.map(ex => (
            <div key={ex.name} className="border rounded-lg p-4">
              <div className="font-medium">{ex.name}</div>
              <p className="text-sm text-gray-600 mt-2">{ex.description}</p>
              <div className="mt-3 flex gap-2">
                <button disabled={busy} onClick={() => addSql(ex)} className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">Add & open</button>
                <button className="px-3 py-1.5 text-sm rounded border" onClick={() => addToLibrary({ name: ex.name, type: 'sql', config: ex.config })}>Save to My Library</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* My Library */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">My Library</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm rounded border" onClick={async ()=>{ try { const remote = await serverList(); setLibrary(remote); localStorage.setItem('unicon_templates_v1', JSON.stringify(remote)); } catch(e){ alert(e.message); } }}>Sync from Server</button>
            <button className="px-3 py-1.5 text-sm rounded border" onClick={async ()=>{ try { const list = getLibrary(); await serverImport(list); alert('Uploaded to server'); } catch(e){ alert(e.message); } }}>Save all to Server</button>
            <button className="px-3 py-1.5 text-sm rounded border" onClick={exportLibrary}>Export</button>
            <button className="px-3 py-1.5 text-sm rounded border" onClick={() => importRef.current?.click()}>Import</button>
            <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={async (e)=>{ const f=e.target.files?.[0]; if (!f) return; try { await importLibrary(f); setLibrary(getLibrary()); } catch(err) { alert(err.message || 'Import failed'); } finally { e.target.value=''; } }} />
          </div>
        </div>
        {library.length === 0 ? (
          <p className="text-sm text-gray-600">No templates saved yet. Use “Save to My Library” on any example or “Save as template” from a connection.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {library.map(t => (
              <div key={t.id} className="border rounded-lg p-4">
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-gray-500 mt-1">{t.type.toUpperCase()}</div>
                <div className="mt-3 flex gap-2">
                  <button className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white" onClick={()=>createFromTemplate(t)}>Create & open</button>
                  <button className="px-3 py-1.5 text-sm rounded border" onClick={async ()=>{ try { await serverDelete(t.id); const remote = await serverList(); setLibrary(remote); localStorage.setItem('unicon_templates_v1', JSON.stringify(remote)); } catch { deleteTemplate(t.id); setLibrary(getLibrary()); } }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {busy && (
        <div className="fixed bottom-4 right-4 bg-white border rounded shadow px-3 py-2 flex items-center gap-2 text-sm">
          <Spinner size={16} />
          <span>Creating connection…</span>
        </div>
      )}
    </div>
  );
}