// client/src/layout/Sidebar.jsx
import React from 'react';
import { Layers, Globe, Server, Zap, MessageSquare, Database, Settings, List } from 'lucide-react';

export default function Sidebar({ onOpenWorkspace, activeTabKind }) {
  const Item = ({ icon: Icon, label, onClick, active = false }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm hover:bg-gray-100 transition ${
        active ? 'bg-gray-100 font-medium' : ''
      }`}
    >
      <Icon size={18} className="text-gray-700" />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="w-64 border-r border-gray-200 bg-white p-4 space-y-4">
      <div className="px-2 text-xs uppercase text-gray-500 tracking-wide">General</div>
      <div className="space-y-1">
        <Item icon={List} label="Connections" onClick={() => onOpenWorkspace('connections')} />
      </div>
      <div className="pt-4 border-t border-gray-200" />
      <div className="px-2 text-xs uppercase text-gray-500 tracking-wide">Workspaces</div>
      <div className="space-y-1">
        <Item icon={Globe} label="REST" onClick={() => onOpenWorkspace('rest')} active={activeTabKind === 'rest'} />
        <Item icon={Server} label="OPC UA" onClick={() => onOpenWorkspace('opcua')} />
        <Item icon={Zap} label="WebSocket" onClick={() => onOpenWorkspace('ws')} />
        <Item icon={Layers} label="SSH" onClick={() => onOpenWorkspace('ssh')} />
        <Item icon={Server} label="Kubernetes" onClick={() => onOpenWorkspace('k8s')} />
        <Item icon={MessageSquare} label="gRPC" onClick={() => onOpenWorkspace('grpc')} />
        <Item icon={Layers} label="CPD" onClick={() => onOpenWorkspace('cpd')} />
        <Item icon={Database} label="SQL" onClick={() => onOpenWorkspace('sql')} />
      </div>

      <div className="pt-4 border-t border-gray-200" />
      <div className="px-2 text-xs uppercase text-gray-500 tracking-wide">System</div>
      <div className="space-y-1">
        <Item icon={Settings} label="Settings" onClick={() => {}} />
      </div>
    </aside>
  );
}
