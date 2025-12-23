// client/src/workspaces/opcua/OpcUaWorkspace.jsx
import React, { useEffect, useState } from 'react';
import { RefreshCw, Settings, Database } from 'lucide-react';
import Button from '../../ui/Button.jsx';
import Input from '../../ui/Input.jsx';
import ConnectionBadge from '../../ui/ConnectionBadge.jsx';

export default function OpcUaWorkspace({ connection }) {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeValue, setNodeValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const browseNodes = async () => {
    if (!connection || connection.status !== 'connected') return;
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

  useEffect(() => { if (connection?.status === 'connected') browseNodes(); }, [connection?.status]);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">OPC UA Browser</h3>
        <div className="flex items-center gap-3">
          <ConnectionBadge connection={connection} />
          <Button variant="secondary" onClick={browseNodes} disabled={isLoading} leftEl={<RefreshCw size={16} className={isLoading ? 'mr-2 animate-spin' : 'mr-2'} />}>Refresh</Button>
        </div>
      </div>
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
              <p className="text-sm">No nodes available</p>
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
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1">Read</Button>
                <Button className="flex-1">Write</Button>
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
