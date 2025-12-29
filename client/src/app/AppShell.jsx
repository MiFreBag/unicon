// client/src/app/AppShell.jsx
import React, { useMemo, useState, useCallback } from 'react';
import Sidebar from '../layout/Sidebar.jsx';
import Header from '../layout/Header.jsx';
import TabStrip from '../layout/TabStrip.jsx';
import ContentFrame from '../layout/ContentFrame.jsx';
import RestWorkspace from '../workspaces/RestWorkspace.jsx';
import BackendStatus from '../components/BackendStatus.jsx';
import OpcUaWorkspace from '../workspaces/opcua/OpcUaWorkspace.jsx';
import WebSocketWorkspace from '../workspaces/ws/WebSocketWorkspace.jsx';
import GrpcWorkspace from '../workspaces/grpc/GrpcWorkspace.jsx';
import CpdWorkspace from '../workspaces/CpdWorkspace.jsx';
import SqlWorkspace from '../workspaces/sql/SqlWorkspace.jsx';
import SSHWorkspace from '../workspaces/ssh/SSHWorkspace.jsx';
import K8sWorkspace from '../workspaces/k8s/K8sWorkspace.jsx';
import { Globe, Server, Zap, MessageSquare, Layers, Database, List } from 'lucide-react';
import ConnectionList from '../features/connections/ConnectionList.jsx';

import Login from '../auth/Login.jsx';
import { getToken, clearAuth } from '../lib/auth';

import OAuthCallback from '../auth/OAuthCallback.jsx';
import ResetPassword from '../auth/ResetPassword.jsx';
export default function AppShell() {
  // Registry of workspaces available to open in tabs
  const registry = useMemo(() => ({
    connections: { title: 'Connections', icon: List, component: ConnectionList },
    rest: { title: 'REST Client', icon: Globe, component: RestWorkspace },
    opcua: { title: 'OPC UA', icon: Server, component: OpcUaWorkspace },
    ws: { title: 'WebSocket', icon: Zap, component: WebSocketWorkspace },
    ssh: { title: 'SSH', icon: Layers, component: SSHWorkspace },
    k8s: { title: 'Kubernetes', icon: Server, component: K8sWorkspace },
    grpc: { title: 'gRPC', icon: MessageSquare, component: GrpcWorkspace },
    cpd: { title: 'CPD', icon: Layers, component: CpdWorkspace },
    sql: { title: 'SQL', icon: Database, component: SqlWorkspace },
    'helpers-network': { title: 'Network Tools', icon: Server, component: React.lazy(() => import('../workspaces/helpers/NetworkTools.jsx')) },
    'helpers-format': { title: 'JSON/YAML Tools', icon: Layers, component: React.lazy(() => import('../workspaces/helpers/FormatTools.jsx')) },
  }), []);

  // Tabs with persistence
  const [tabs, setTabs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tabs_v1') || 'null');
      if (saved && Array.isArray(saved) && saved.length) return saved;
    } catch {}
    const lastKind = (() => { try { return localStorage.getItem('last_workspace_kind_v1') || 'rest'; } catch { return 'rest'; } })();
    const id = `${lastKind}-1`;
    const def = registry[lastKind] || registry.rest;
    return [{ id, kind: lastKind, title: def.title, params: {} }];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    return localStorage.getItem('active_tab_v1') || 'rest-1';
  });

  const openTab = useCallback((kind, params = {}) => {
    const def = registry[kind];
    if (!def) return;
    const id = `${kind}-${Date.now()}`;
    setTabs(prev => [...prev, { id, kind, title: def.title, params }]);
    setActiveTabId(id);
    try { localStorage.setItem('last_workspace_kind_v1', kind); } catch {}
  }, [registry]);
  const closeTab = useCallback((id) => {
    setTabs(prev => prev.filter(t => t.id !== id));
    setActiveTabId(prev => {
      if (prev === id) {
        // activate last tab if current was closed
        const remaining = tabs.filter(t => t.id !== id);
        return remaining.length ? remaining[remaining.length - 1].id : null;
      }
      return prev;
    });
  }, [tabs]);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const activateTab = useCallback((id) => setActiveTabId(id), []);

  // Persist tabs
  React.useEffect(() => {
    try { localStorage.setItem('tabs_v1', JSON.stringify(tabs)); } catch {}
  }, [tabs]);
  React.useEffect(() => {
    try { if (activeTabId) localStorage.setItem('active_tab_v1', activeTabId); } catch {}
  }, [activeTabId]);

  // Keyboard shortcuts: Ctrl/Cmd+W closes active tab
  React.useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTabId, closeTab]);

  // Handle Reset Password route
  if (typeof window !== 'undefined' && window.location.pathname.endsWith('/auth/reset')) {
    return <ResetPassword />
  }

  // Handle OAuth callback route
  if (typeof window !== 'undefined' && window.location.pathname.endsWith('/auth/callback')) {
    return <OAuthCallback />
  }

  // Simple auth gate with optional dev bypass
  const bypass = (import.meta?.env?.VITE_AUTH_BYPASS === '1');
  const authed = bypass || !!getToken();
  if (!authed) {
    return <Login onLoggedIn={() => window.location.reload()} />;
  }

  const activeTab = tabs.find(t => t.id === activeTabId) || null;
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="flex h-screen">
        <Sidebar onOpenWorkspace={openTab} activeTabKind={activeTab?.kind} />
        <div className="flex-1 flex flex-col">
          <Header onNewConnection={() => openTab('connections')} activeTab={activeTab} />
          {/* Backend status banner */}
          <BackendStatus />
          <TabStrip tabs={tabs} activeTabId={activeTabId} onClose={closeTab} onCloseAll={closeAllTabs} onActivate={activateTab} />
          <ContentFrame tabs={tabs} activeTabId={activeTabId} registry={registry} openTab={openTab} />
        </div>
      </div>
    </div>
  );
}
