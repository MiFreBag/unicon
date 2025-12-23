// client/src/workspaces/ws/WebSocketWorkspace.jsx
import React, { useEffect, useState } from 'react';
import Button from '../../ui/Button.jsx';
import Input from '../../ui/Input.jsx';
import ConnectionBadge from '../../ui/ConnectionBadge.jsx';

export default function WebSocketWorkspace({ connection }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [status, setStatus] = useState(connection?.status || 'disconnected');

  useEffect(() => {
    const onWs = (e) => {
      const msg = e.detail || {};
      try {
        if (msg?.type === 'ws' && msg?.data?.connectionId === connection?.id) {
          if (msg.data.event === 'message') {
            setMessages((prev) => [
              ...prev,
              { type: 'received', content: msg.data.data, timestamp: new Date() },
            ]);
          } else if (msg.data.event === 'connected') {
            setStatus('connected');
          } else if (msg.data.event === 'closed') {
            setStatus('disconnected');
            if (autoReconnect && connection?.id) {
              fetch('/unicon/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ connectionId: connection.id }),
              }).catch(() => {});
            }
          }
        }
      } catch (_) {}
    };
    window.addEventListener('unicon-ws', onWs);
    return () => window.removeEventListener('unicon-ws', onWs);
  }, [connection?.id, autoReconnect]);

  const sendMessage = async () => {
    if (!message.trim() || !connection || status !== 'connected') return;
    try {
      await fetch('/unicon/api/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id, operation: 'send', params: { message } }),
      });
      setMessages((prev) => [
        ...prev,
        { type: 'sent', content: message, timestamp: new Date() },
      ]);
      setMessage('');
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">WebSocket Client</h3>
        <ConnectionBadge connection={connection} status={status} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span>Status: {status}</span>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={autoReconnect}
            onChange={(e) => setAutoReconnect(e.target.checked)}
          />
          Auto-reconnect
        </label>
        <Button variant="secondary" disabled={status==='connected'} onClick={() =>
          fetch('/unicon/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionId:connection.id})})
        }>Connect</Button>
        <Button variant="secondary" disabled={status!=='connected'} onClick={() =>
          fetch('/unicon/api/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionId:connection.id})})
        }>Disconnect</Button>
      </div>

      <div className="flex-1 border border-gray-200 rounded-lg p-4">
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-2 rounded ${
                msg.type === 'sent'
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : 'bg-green-50 border-l-4 border-green-500'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {msg.timestamp.toLocaleTimeString()}
              </div>
              <div className="font-mono text-sm">{msg.content}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Enter message..." className="flex-1" onKeyDown={(e)=>e.key==='Enter' && sendMessage()} />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </div>
    </div>
  );
}
