// client/src/workspaces/grpc/GrpcWorkspace.jsx
import React, { useState } from 'react';
import Button from '../../ui/Button.jsx';
import Input from '../../ui/Input.jsx';

export default function GrpcWorkspace({ connectionId: initialConnectionId }) {
  const [address, setAddress] = useState('localhost:50051');
  const [selectedId] = useState(initialConnectionId || null);
  const [proto, setProto] = useState('');
  const [pkg, setPkg] = useState('');
  const [svc, setSvc] = useState('');
  const [method, setMethod] = useState('');
  const [payload, setPayload] = useState('{}');
  const [response, setResponse] = useState(null);

  async function callUnary() {
    try {
      const id = selectedId || await ensureConnection();
      const res = await fetch('/unicon/api/operation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: id,
          operation: 'unary',
          params: { method, request: JSON.parse(payload || '{}') }
        })
      });
      const data = await res.json();
      setResponse(data);
    } catch (e) { setResponse({ error: e.message }); }
  }

  async function ensureConnection() {
    if (selectedId) return selectedId;
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
          <Input label="Address" value={address} onChange={e=>setAddress(e.target.value)} placeholder="localhost:50051" />
        </div>
        <div>
          <Input label="Package" value={pkg} onChange={e=>setPkg(e.target.value)} placeholder="my.package" />
        </div>
        <div>
          <Input label="Service" value={svc} onChange={e=>setSvc(e.target.value)} placeholder="MyService" />
        </div>
        <div>
          <Input label="Method" value={method} onChange={e=>setMethod(e.target.value)} placeholder="SayHello" />
        </div>
      </div>
      <div>
        <Input label="Proto (path under server/proto or absolute)" value={proto} onChange={e=>setProto(e.target.value)} placeholder="helloworld.proto" />
      </div>
      <div>
        <label className="block text-sm font-medium text-swarco-grey-900 mb-1">Payload (JSON)</label>
        <textarea className="w-full border border-swarco-grey-400 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-swarco-blue-200 focus:border-swarco-blue-600" rows={6} value={payload} onChange={e=>setPayload(e.target.value)} />
      </div>
      <Button onClick={callUnary}>Call Unary</Button>
      {response && (
        <div className="text-sm bg-gray-50 border rounded p-3 mt-2">
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
