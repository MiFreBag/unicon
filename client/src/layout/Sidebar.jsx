// client/src/layout/Sidebar.jsx
import React from 'react';
import Icon from '../ui/Icon.jsx';

export default function Sidebar({ onOpenWorkspace, activeTabKind }) {
  const Item = ({ iconName, label, onClick, active = false }) => (
    <button onClick={onClick} className={`sidebar-item ${active ? 'sidebar-item-active' : ''}`}>
      <Icon name={iconName} size={18} className="sidebar-item-icon" />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-section">General</div>
      <div className="space-y-1">
        <Item iconName="layout" label="Dashboard" onClick={() => onOpenWorkspace('dashboard')} />
        <Item iconName="list" label="Connections" onClick={() => onOpenWorkspace('connections')} />
        <Item iconName="globe" label="Examples" onClick={() => onOpenWorkspace('examples')} />
      </div>
      <div className="sidebar-divider" />
      <div className="sidebar-section">Workspaces</div>
      <div className="space-y-1">
        <Item iconName="globe" label="REST" onClick={() => onOpenWorkspace('rest')} active={activeTabKind === 'rest'} />
        <Item iconName="server" label="OPC UA" onClick={() => onOpenWorkspace('opcua')} />
        <Item iconName="bolt" label="WebSocket" onClick={() => onOpenWorkspace('ws')} />
        <Item iconName="layers" label="SSH" onClick={() => onOpenWorkspace('ssh')} />
        <Item iconName="server" label="Kubernetes" onClick={() => onOpenWorkspace('k8s')} />
        <Item iconName="message-square" label="gRPC" onClick={() => onOpenWorkspace('grpc')} />
        <Item iconName="layers" label="CPD" onClick={() => onOpenWorkspace('cpd')} />
        <Item iconName="database" label="SQL" onClick={() => onOpenWorkspace('sql')} />
        <Item iconName="layers" label="File Commander" onClick={() => onOpenWorkspace('commander')} />
      </div>

      <div className="sidebar-divider" />
      <div className="sidebar-section">Tools</div>
      <div className="space-y-1">
        <Item iconName="activity" label="Network Tools" onClick={() => onOpenWorkspace('helpers-network')} />
        <Item iconName="braces" label="JSON/YAML Tools" onClick={() => onOpenWorkspace('helpers-format')} />
      </div>

      <div className="sidebar-divider" />
      <div className="sidebar-section">System</div>
      <div className="space-y-1">
        <Item iconName="gear" label="Settings" onClick={() => {}} />
        <Item iconName="list" label="Templates" onClick={() => onOpenWorkspace('templates')} />
      </div>
    </aside>
  );
}
