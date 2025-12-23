// client/src/workspaces/grpc/GrpcWorkspace.jsx
import React from 'react';

import React, { useState } from 'react';

export default function GrpcWorkspace() {
  const [address, setAddress] = useState('localhost:50051');
  const [proto, setProto] = useState('');
  const [pkg, setPkg] = useState('');
  const [svc, setSvc] = useState('');
  const [method, setMethod] = useState('');
  const [payload, setPayload] = useState('{}');
  const [response, setResponse] = useState(null);

  async function callUnary() {
    try {
      const res = await fetch('/unicon/api/operation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: await ensureConnection(),
          operation: 'unary',
          params: { method, request: JSON.parse(payload || '{}') }
        })
      });
      const data = await res.json();
      setResponse(data);
    } catch (e) { setResponse({ error: e.message }); }
  }

  async function ensureConnection() {
    // Create or reuse a connection for this session by pushing config to server and connecting
    const createRes = await fetch('/unicon/api/connections', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `grpc:${address}`, type: 'grpc', config: { address, proto, package: pkg, service: svc } })
    }).then(r => r.json());
    const id = createRes.connection.id;
    await fetch('/unicon/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId: id }) });
    return id;
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-lg font-medium">gRPC Workspace</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm">Address</label>
          <input className="w-full border rounded px-2 py-1" value={address} onChange={e=>setAddress(e.target.value)} placeholder="localhost:50051" />
        </div>
        <div>
          <label className="block text-sm">Package</label>
          <input className="w-full border rounded px-2 py-1" value={pkg} onChange={e=>setPkg(e.target.value)} placeholder="my.package" />
        </div>
        <div>
          <label className="block text-sm">Service</label>
          <input className="w-full border rounded px-2 py-1" value={svc} onChange={e=>setSvc(e.target.value)} placeholder="MyService" />
        </div>
        <div>
          <label className="block text-sm">Method</label>
          <input className="w-full border rounded px-2 py-1" value={method} onChange={e=>setMethod(e.target.value)} placeholder="SayHello" />
        </div>
      </div>
      <div>
        <label className="block text-sm">Proto (path under server/proto or absolute)</label>
        <input className="w-full border rounded px-2 py-1" value={proto} onChange={e=>setProto(e.target.value)} placeholder="helloworld.proto" />
      </div>
      <div>
        <label className="block text-sm">Payload (JSON)</label>
        <textarea className="w-full border rounded px-2 py-1 font-mono text-sm" rows={6} value={payload} onChange={e=>setPayload(e.target.value)} />
      </div>
      <button className="px-3 py-1.5 border rounded" onClick={callUnary}>Call Unary</button>
      {response && (
        <div className="text-sm bg-gray-50 border rounded p-3 mt-2">
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
