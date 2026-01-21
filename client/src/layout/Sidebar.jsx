// client/src/layout/Sidebar.jsx
import React from 'react';
import Icon from '../ui/Icon.jsx';

export default function Sidebar({ onOpenWorkspace, activeTabKind }) {
  const Item = ({ iconName, label, onClick, active = false }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm hover:bg-gray-100 transition ${
        active ? 'bg-gray-100 font-medium' : ''
      }`}
    >
      <Icon name={iconName} size={18} className="text-gray-700" />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="w-64 border-r border-gray-200 bg-white p-4 space-y-4">
      <div className="px-2 text-xs uppercase text-gray-500 tracking-wide">General</div>
      <div className="space-y-1">
        <Item iconName="list" label="Connections" onClick={() => onOpenWorkspace('connections')} />
        <Item iconName="globe" label="Examples" onClick={() => onOpenWorkspace('examples')} />
      </div>
      <div className="pt-4 border-t border-gray-200" />
      <div className="px-2 text-xs uppercase text-gray-500 tracking-wide">Workspaces</div>
      <div className="space-y-1">
        <Item iconName="globe" label="REST" onClick={() => onOpenWorkspace('rest')} active={activeTabKind === 'rest'} />
        <Item iconName="server" label="OPC UA" onClick={() => onOpenWorkspace('opcua')} />
        <Item iconName="bolt" label="WebSocket" onClick={() => onOpenWorkspace('ws')} />
        <Item iconName="layers" label="SSH" onClick={() => onOpenWorkspace('ssh')} />
        <Item iconName="server" label="Kubernetes" onClick={() => onOpenWorkspace('k8s')} />
        <Item iconName="message-square" label="gRPC" onClick={() => onOpenWorkspace('grpc')} />
        <Item iconName="layers" label="CPD" onClick={() => onOpenWorkspace('cpd')} />
        <Item iconName="database" label="SQL" onClick={() => onOpenWorkspace('sql')} />
      </div>

      <div className="pt-4 border-t border-gray-200" />
      <div className="px-2 text-xs uppercase text-gray-500 tracking-wide">Tools</div>
      <div className="space-y-1">
        <Item iconName="activity" label="Network Tools" onClick={() => onOpenWorkspace('helpers-network')} />
        <Item iconName="braces" label="JSON/YAML Tools" onClick={() => onOpenWorkspace('helpers-format')} />
      </div>

      <div className="pt-4 border-t border-gray-200" />
      <div className="px-2 text-xs uppercase text-gray-500 tracking-wide">System</div>
      <div className="space-y-1">
        <Item iconName="gear" label="Settings" onClick={() => {}} />
        <Item iconName="list" label="Templates" onClick={() => onOpenWorkspace('templates')} />
      </div>
    </aside>
  );
}
