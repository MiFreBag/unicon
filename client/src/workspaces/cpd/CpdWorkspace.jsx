// client/src/workspaces/cpd/CpdWorkspace.jsx
import React, { useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';

import ConnectionBadge from '../../ui/ConnectionBadge.jsx';

export default function CpdWorkspace({ connection }) {
  const [topic, setTopic] = useState('sw.sensor.temperature');
  const [payload, setPayload] = useState('{"value": 23.5}');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const publish = async () => {
    if (!connection || connection.status !== 'connected') return;
    setIsLoading(true);
    try {
      let data;
      try { data = JSON.parse(payload); } catch { data = payload; }
      const res = await fetch('/unicon/api/operation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id, operation: 'publish', params: { topic, data, mode: 'publish' } })
      });
      const result = await res.json();
      if (result.success) {
        setMessages(prev => [...prev, { type: 'publish', topic, data, ts: new Date() }]);
      }
    } finally { setIsLoading(false); }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">CPD Workspace</h3>
        <ConnectionBadge connection={connection} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <input className="w-full border rounded px-3 py-2" value={topic} onChange={e => setTopic(e.target.value)} />
          <textarea className="w-full border rounded px-3 py-2 font-mono text-sm" rows={5} value={payload} onChange={e => setPayload(e.target.value)} />
          <button onClick={publish} disabled={isLoading} className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50">
            {isLoading ? <RefreshCw size={16} className="inline animate-spin" /> : <Send size={16} className="inline" />} Publish
          </button>
        </div>
        <div className="border rounded p-3">
          <h4 className="font-medium mb-2">Messages</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                <span className="font-mono text-gray-600">{m.ts.toLocaleTimeString()}</span> → <span className="font-mono">{m.topic}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
