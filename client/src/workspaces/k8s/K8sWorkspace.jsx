// client/src/workspaces/k8s/K8sWorkspace.jsx
// k9s-like Kubernetes management interface
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { listConnections, connectConnection, disconnectConnection, op } from '../../lib/api';
import { 
  RefreshCw, Play, Square, Server, Box, Layers, Settings, Database,
  Network, Clock, Shield, HardDrive, Users, Activity, Workflow,
  ChevronRight, ChevronDown, Terminal, X, Zap, Share2, Cpu, MemoryStick,
  Pause, ToggleLeft, ToggleRight, Sun, Moon, Heart, Edit, Ban, CheckCircle2, Trash2
} from 'lucide-react';
import ConnectionBadge from '../../ui/ConnectionBadge.jsx';
import K8sResourceTable from './K8sResourceTable.jsx';
import K8sYamlViewer from './K8sYamlViewer.jsx';
import K8sTerminal from './K8sTerminal.jsx';
import K8sPulseView from './K8sPulseView.jsx';

// Theme definitions
const THEMES = {
  dark: {
    bg: 'bg-gray-900',
    sidebar: 'bg-gray-850',
    header: 'bg-gray-800',
    panel: 'bg-gray-800',
    border: 'border-gray-700',
    text: 'text-gray-200',
    textMuted: 'text-gray-400',
    textFaint: 'text-gray-500',
    input: 'bg-gray-800 border-gray-700 text-gray-200',
    inputDark: 'bg-gray-900 border-gray-700 text-white',
    hover: 'hover:bg-gray-800',
    active: 'bg-blue-600 text-white',
    button: 'text-gray-400 hover:text-white hover:bg-gray-700',
  },
  light: {
    bg: 'bg-white',
    sidebar: 'bg-gray-50',
    header: 'bg-gray-100',
    panel: 'bg-white',
    border: 'border-gray-200',
    text: 'text-gray-900',
    textMuted: 'text-gray-600',
    textFaint: 'text-gray-500',
    input: 'bg-white border-gray-300 text-gray-900',
    inputDark: 'bg-gray-50 border-gray-300 text-gray-900',
    hover: 'hover:bg-gray-100',
    active: 'bg-blue-600 text-white',
    button: 'text-gray-600 hover:text-gray-900 hover:bg-gray-200',
  },
};

// Resource type icons and groups
const RESOURCE_GROUPS = {
  workloads: {
    label: 'Workloads',
    icon: Box,
    resources: ['pods', 'deployments', 'statefulsets', 'daemonsets', 'replicasets', 'jobs', 'cronjobs'],
  },
  network: {
    label: 'Network',
    icon: Network,
    resources: ['services', 'ingresses', 'endpoints'],
  },
  config: {
    label: 'Config',
    icon: Settings,
    resources: ['configmaps', 'secrets', 'serviceaccounts'],
  },
  storage: {
    label: 'Storage',
    icon: HardDrive,
    resources: ['persistentvolumeclaims', 'persistentvolumes'],
  },
  cluster: {
    label: 'Cluster',
    icon: Server,
    resources: ['nodes', 'namespaces', 'events'],
  },
};

const RESOURCE_ICONS = {
  pods: Box,
  deployments: Layers,
  services: Network,
  configmaps: Settings,
  secrets: Shield,
  statefulsets: Database,
  daemonsets: Server,
  jobs: Workflow,
  cronjobs: Clock,
  ingresses: Network,
  persistentvolumeclaims: HardDrive,
  persistentvolumes: HardDrive,
  nodes: Server,
  namespaces: Layers,
  events: Activity,
  replicasets: Layers,
  endpoints: Network,
  serviceaccounts: Users,
};

export default function K8sWorkspace({ connectionId: initialConnectionId }) {
  // Connection state
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [loading, setLoading] = useState(false);
  
  // Cluster state
  const [contexts, setContexts] = useState([]);
  const [currentContext, setCurrentContext] = useState('');
  const [namespaces, setNamespaces] = useState([]);
  const [namespace, setNamespace] = useState('default');
  const [allNamespaces, setAllNamespaces] = useState(false);
  
  // Resource browsing state
  const [resourceType, setResourceType] = useState('pods');
  const [resources, setResources] = useState([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [expandedGroups, setExpandedGroups] = useState({ workloads: true });
  
  // Panels
  const [yamlPanel, setYamlPanel] = useState(null); // { yaml, name, type, namespace }
  const [terminalPanel, setTerminalPanel] = useState(null); // { mode, sessionId, logId, pod, container }
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [command, setCommand] = useState('');
  
  // Scale dialog
  const [scaleDialog, setScaleDialog] = useState(null);
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  
  // Port forwarding
  const [portForwards, setPortForwards] = useState([]);
  const [portForwardDialog, setPortForwardDialog] = useState(null);
  
  // Metrics
  const [showMetrics, setShowMetrics] = useState(false);
  const [podMetrics, setPodMetrics] = useState([]);
  const [nodeMetrics, setNodeMetrics] = useState([]);
  
  // Container selector for multi-container pods
  const [containerDialog, setContainerDialog] = useState(null);
  
  // Pulse view
  const [showPulse, setShowPulse] = useState(false);
  const [pulseData, setPulseData] = useState(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  
  // Edit YAML mode
  const [editMode, setEditMode] = useState(false);
  
  // Node action dialog
  const [nodeActionDialog, setNodeActionDialog] = useState(null);
  
  // All resource types dialog
  const [showAllResources, setShowAllResources] = useState(false);
  const [allResourceTypes, setAllResourceTypes] = useState([]);
  
  // Theme (persisted)
  const [themeName, setThemeName] = useState(() => {
    try { return localStorage.getItem('unicon_k8s_theme') || 'light'; } catch { return 'light'; }
  });
  const theme = THEMES[themeName] || THEMES.dark;
  
  const toggleTheme = () => {
    const next = themeName === 'dark' ? 'light' : 'dark';
    setThemeName(next);
    try { localStorage.setItem('unicon_k8s_theme', next); } catch {}
  };

  const k8sConnections = useMemo(() => (connections || []).filter(c => c.type === 'k8s'), [connections]);
  const selectedConnection = useMemo(() => k8sConnections.find(c => c.id === selectedId), [k8sConnections, selectedId]);

  // Load connections on mount
  useEffect(() => {
    (async () => {
      const res = await listConnections();
      setConnections(res.connections || []);
      const list = (res.connections || []).filter(c => c.type === 'k8s');
      const preferred = list.find(c => c.id === initialConnectionId);
      const first = preferred || list[0];
      if (first) setSelectedId(first.id);
    })();
  }, [initialConnectionId]);

  // Connect to cluster
  const handleConnect = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      await connectConnection(selectedId);
      setStatus('connected');
      await refreshContexts();
      await refreshNamespaces();
      await loadResources('pods');
    } catch (e) {
      console.error('Connect failed:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // Quick connect - connect immediately on selection if disconnected
  const handleQuickConnect = useCallback(async (connId) => {
    setSelectedId(connId);
    if (status === 'disconnected') {
      setLoading(true);
      try {
        await connectConnection(connId);
        setStatus('connected');
        const ctxRes = await op(connId, 'contexts', {});
        const ctxData = ctxRes?.data || ctxRes;
        setContexts((ctxData.contexts || []).map(c => c.name || c));
        setCurrentContext(ctxData.current || '');
        
        const nsRes = await op(connId, 'namespaces', {});
        const nsData = nsRes?.data || nsRes;
        setNamespaces(nsData.namespaces || []);
        if (nsData.namespaces?.length) {
          setNamespace(nsData.namespaces.includes('default') ? 'default' : nsData.namespaces[0]);
        }
        
        await loadResourcesForConnection(connId, 'pods', 'default');
      } catch (e) {
        console.error('Quick connect failed:', e);
      } finally {
        setLoading(false);
      }
    }
  }, [status]);

  // Disconnect
  const handleDisconnect = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      await disconnectConnection(selectedId);
      setStatus('disconnected');
      setContexts([]);
      setNamespaces([]);
      setResources([]);
      setYamlPanel(null);
      setTerminalPanel(null);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // Refresh contexts
  const refreshContexts = useCallback(async () => {
    if (!selectedId || status !== 'connected') return;
    const res = await op(selectedId, 'contexts', {});
    const data = res?.data || res;
    setContexts((data.contexts || []).map(c => c.name || c));
    setCurrentContext(data.current || '');
  }, [selectedId, status]);

  // Switch context
  const switchContext = useCallback(async (name) => {
    if (!selectedId || status !== 'connected') return;
    await op(selectedId, 'useContext', { name });
    setCurrentContext(name);
    await refreshNamespaces();
    await loadResources(resourceType);
  }, [selectedId, status, resourceType]);

  // Refresh namespaces
  const refreshNamespaces = useCallback(async () => {
    if (!selectedId || status !== 'connected') return;
    const res = await op(selectedId, 'namespaces', {});
    const data = res?.data || res;
    setNamespaces(data.namespaces || []);
    if (data.namespaces?.length && !data.namespaces.includes(namespace)) {
      setNamespace(data.namespaces[0]);
    }
  }, [selectedId, status, namespace]);

  // Load resources
  const loadResources = useCallback(async (type, ns = namespace) => {
    if (!selectedId || status !== 'connected') return;
    setResourceLoading(true);
    setSelectedIndex(-1);
    try {
      const res = await op(selectedId, 'listResources', { resourceType: type, namespace: allNamespaces ? undefined : ns });
      const data = res?.data || res;
      setResources(data.items || []);
    } catch (e) {
      console.error('Load resources failed:', e);
      setResources([]);
    } finally {
      setResourceLoading(false);
    }
  }, [selectedId, status, namespace, allNamespaces]);

  // Helper for quick connect
  const loadResourcesForConnection = async (connId, type, ns) => {
    setResourceLoading(true);
    try {
      const res = await op(connId, 'listResources', { resourceType: type, namespace: ns });
      const data = res?.data || res;
      setResources(data.items || []);
    } catch (e) {
      setResources([]);
    } finally {
      setResourceLoading(false);
    }
  };

  // Handle resource type change
  const handleResourceTypeChange = useCallback((type) => {
    setResourceType(type);
    loadResources(type);
  }, [loadResources]);

  // Handle namespace change
  const handleNamespaceChange = useCallback((ns) => {
    setNamespace(ns);
    loadResources(resourceType, ns);
  }, [resourceType, loadResources]);

  // Toggle all namespaces
  const toggleAllNamespaces = useCallback(() => {
    setAllNamespaces(prev => {
      const newVal = !prev;
      loadResources(resourceType, newVal ? undefined : namespace);
      return newVal;
    });
  }, [resourceType, namespace, loadResources]);

  // Handle resource actions
  const handleAction = useCallback(async (action, item) => {
    if (!selectedId || !item) return;
    
    switch (action) {
      case 'describe': {
        try {
          const res = await op(selectedId, 'describe', {
            resourceType,
            name: item.name,
            namespace: item.namespace || namespace,
          });
          const data = res?.data || res;
          setYamlPanel({
            yaml: data.yaml,
            name: item.name,
            type: resourceType,
            namespace: item.namespace || namespace,
          });
        } catch (e) {
          console.error('Describe failed:', e);
        }
        break;
      }
      
      case 'logs': {
        try {
          const res = await op(selectedId, 'logsStart', {
            namespace: item.namespace || namespace,
            pod: item.name,
            container: item.containers?.[0],
            tailLines: 500,
          });
          const data = res?.data || res;
          setTerminalPanel({
            mode: 'logs',
            logId: data.id,
            pod: item.name,
            container: item.containers?.[0],
          });
        } catch (e) {
          console.error('Logs failed:', e);
        }
        break;
      }
      
      case 'shell': {
        try {
          const res = await op(selectedId, 'execOpen', {
            namespace: item.namespace || namespace,
            pod: item.name,
            container: item.containers?.[0],
            command: ['/bin/sh'],
            tty: true,
          });
          const data = res?.data || res;
          setTerminalPanel({
            mode: 'exec',
            sessionId: data.id,
            pod: item.name,
            container: item.containers?.[0],
          });
        } catch (e) {
          console.error('Exec failed:', e);
        }
        break;
      }
      
      case 'scale': {
        setScaleDialog({
          name: item.name,
          namespace: item.namespace || namespace,
          currentReplicas: parseInt(item.ready?.split('/')[1] || '0', 10),
        });
        break;
      }
      
      case 'restart': {
        if (confirm(`Restart deployment ${item.name}?`)) {
          try {
            await op(selectedId, 'restart', {
              name: item.name,
              namespace: item.namespace || namespace,
            });
            setTimeout(() => loadResources(resourceType), 1000);
          } catch (e) {
            console.error('Restart failed:', e);
          }
        }
        break;
      }
      
      case 'delete': {
        if (confirm(`Delete ${resourceType.slice(0, -1)} ${item.name}?`)) {
          try {
            await op(selectedId, 'delete', {
              resourceType,
              name: item.name,
              namespace: item.namespace || namespace,
            });
            setTimeout(() => loadResources(resourceType), 500);
          } catch (e) {
            console.error('Delete failed:', e);
          }
        }
        break;
      }
      
      case 'portForward': {
        setPortForwardDialog({ pod: item.name, mode: 'create' });
        break;
      }
      
      case 'nodeAction': {
        setNodeActionDialog({ name: item.name });
        break;
      }
    }
  }, [selectedId, resourceType, namespace, loadResources]);

  // Handle scale
  const handleScale = useCallback(async (replicas) => {
    if (!scaleDialog || !selectedId) return;
    try {
      await op(selectedId, 'scale', {
        resourceType,
        name: scaleDialog.name,
        namespace: scaleDialog.namespace,
        replicas,
      });
      setScaleDialog(null);
      setTimeout(() => loadResources(resourceType), 1000);
    } catch (e) {
      console.error('Scale failed:', e);
    }
  }, [selectedId, resourceType, scaleDialog, loadResources]);

  // Close terminal
  const closeTerminal = useCallback(async () => {
    if (!terminalPanel || !selectedId) return;
    try {
      if (terminalPanel.mode === 'logs' && terminalPanel.logId) {
        await op(selectedId, 'logsStop', { id: terminalPanel.logId });
      } else if (terminalPanel.mode === 'exec' && terminalPanel.sessionId) {
        await op(selectedId, 'execClose', { id: terminalPanel.sessionId });
      }
    } catch (_) {}
    setTerminalPanel(null);
  }, [selectedId, terminalPanel]);

  // Handle terminal input
  const handleTerminalInput = useCallback(async (data) => {
    if (!terminalPanel?.sessionId || !selectedId) return;
    try {
      await op(selectedId, 'execInput', { id: terminalPanel.sessionId, data });
    } catch (_) {}
  }, [selectedId, terminalPanel]);

  // ========== AUTO-REFRESH ==========
  useEffect(() => {
    if (!autoRefresh || status !== 'connected') return;
    const interval = setInterval(() => {
      loadResources(resourceType);
      if (showMetrics) {
        loadMetrics();
      }
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, status, resourceType, refreshInterval, showMetrics]);

  // ========== PORT FORWARDING ==========
  const loadPortForwards = useCallback(async () => {
    if (!selectedId || status !== 'connected') return;
    try {
      const res = await op(selectedId, 'portForwards', {});
      setPortForwards(res?.data?.forwards || []);
    } catch (_) {}
  }, [selectedId, status]);

  const startPortForward = useCallback(async (pod, podPort, localPort) => {
    if (!selectedId) return;
    try {
      await op(selectedId, 'portForwardStart', {
        namespace,
        pod,
        podPort: parseInt(podPort, 10),
        localPort: parseInt(localPort, 10) || undefined,
      });
      setPortForwardDialog(null);
      setTimeout(loadPortForwards, 500);
    } catch (e) {
      console.error('Port forward failed:', e);
    }
  }, [selectedId, namespace, loadPortForwards]);

  const stopPortForward = useCallback(async (id) => {
    if (!selectedId) return;
    try {
      await op(selectedId, 'portForwardStop', { id });
      setTimeout(loadPortForwards, 300);
    } catch (_) {}
  }, [selectedId, loadPortForwards]);

  // ========== METRICS ==========
  const loadMetrics = useCallback(async () => {
    if (!selectedId || status !== 'connected') return;
    try {
      if (resourceType === 'pods' || resourceType === 'nodes') {
        const res = resourceType === 'nodes'
          ? await op(selectedId, 'nodeMetrics', {})
          : await op(selectedId, 'podMetrics', { namespace: allNamespaces ? undefined : namespace });
        if (resourceType === 'nodes') {
          setNodeMetrics(res?.data?.metrics || []);
        } else {
          setPodMetrics(res?.data?.metrics || []);
        }
      }
    } catch (_) {
      // Metrics server might not be available
    }
  }, [selectedId, status, resourceType, namespace, allNamespaces]);

  useEffect(() => {
    if (showMetrics && status === 'connected') {
      loadMetrics();
    }
  }, [showMetrics, resourceType, namespace, status]);

  // ========== MULTI-CONTAINER SUPPORT ==========
  const openWithContainerSelection = useCallback(async (action, item) => {
    if (!item.containers || item.containers.length <= 1) {
      // Single container, proceed directly
      handleAction(action, item);
      return;
    }
    // Multiple containers, show selector
    setContainerDialog({ action, item });
  }, [handleAction]);

  const handleContainerSelect = useCallback(async (container) => {
    if (!containerDialog) return;
    const { action, item } = containerDialog;
    const itemWithContainer = { ...item, containers: [container] };
    setContainerDialog(null);
    handleAction(action, itemWithContainer);
  }, [containerDialog, handleAction]);

  // Load port forwards on connect
  useEffect(() => {
    if (status === 'connected') {
      loadPortForwards();
    }
  }, [status, loadPortForwards]);

  // ========== PULSE VIEW ==========
  const loadPulse = useCallback(async () => {
    if (!selectedId || status !== 'connected') return;
    setPulseLoading(true);
    try {
      const res = await op(selectedId, 'pulse', {});
      setPulseData(res?.data || null);
    } catch (e) {
      console.error('Pulse load failed:', e);
    } finally {
      setPulseLoading(false);
    }
  }, [selectedId, status]);

  useEffect(() => {
    if (showPulse && status === 'connected') {
      loadPulse();
    }
  }, [showPulse, status]);

  // ========== NODE MANAGEMENT ==========
  const handleNodeAction = useCallback(async (action, nodeName, options = {}) => {
    if (!selectedId) return;
    try {
      let res;
      switch (action) {
        case 'cordon':
          res = await op(selectedId, 'cordonNode', { name: nodeName });
          break;
        case 'uncordon':
          res = await op(selectedId, 'uncordonNode', { name: nodeName });
          break;
        case 'drain':
          res = await op(selectedId, 'drainNode', { name: nodeName, ...options });
          break;
      }
      setNodeActionDialog(null);
      setTimeout(() => loadResources('nodes'), 500);
      return res;
    } catch (e) {
      console.error(`Node ${action} failed:`, e);
      alert(`Node ${action} failed: ${e.message}`);
    }
  }, [selectedId, loadResources]);

  // ========== EDIT YAML ==========
  const handleApplyYaml = useCallback(async (yamlContent) => {
    if (!selectedId) return;
    try {
      const res = await op(selectedId, 'applyYaml', { yaml: yamlContent });
      setYamlPanel(null);
      setEditMode(false);
      setTimeout(() => loadResources(resourceType), 500);
      return res;
    } catch (e) {
      console.error('Apply YAML failed:', e);
      alert(`Apply failed: ${e.message}`);
    }
  }, [selectedId, resourceType, loadResources]);

  // ========== ALL RESOURCE TYPES ==========
  const loadAllResourceTypes = useCallback(async () => {
    if (!selectedId || status !== 'connected') return;
    try {
      const res = await op(selectedId, 'allResourceTypes', {});
      setAllResourceTypes(res?.data?.resourceTypes || []);
    } catch (_) {}
  }, [selectedId, status]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Command palette
      if (e.key === ':' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }
      
      // Refresh
      if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        loadResources(resourceType);
        return;
      }
      
      // Ctrl+A - show all resource types
      if (e.key === 'a' && e.ctrlKey && status === 'connected') {
        e.preventDefault();
        loadAllResourceTypes();
        setShowAllResources(true);
        return;
      }
      
      // Quick resource switches
      if (!e.target.matches('input, textarea')) {
        if (e.key === '1') handleResourceTypeChange('pods');
        if (e.key === '2') handleResourceTypeChange('deployments');
        if (e.key === '3') handleResourceTypeChange('services');
        if (e.key === '4') handleResourceTypeChange('configmaps');
        if (e.key === '5') handleResourceTypeChange('secrets');
        if (e.key === '6') handleResourceTypeChange('nodes');
        if (e.key === 'p' && e.shiftKey) { setShowPulse(p => !p); } // Shift+P for pulse
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [resourceType, loadResources, handleResourceTypeChange]);

  // Handle command
  const executeCommand = useCallback((cmd) => {
    const parts = cmd.trim().toLowerCase().split(/\s+/);
    const [action, ...args] = parts;
    
    switch (action) {
      case 'pods':
      case 'po':
        handleResourceTypeChange('pods');
        break;
      case 'deployments':
      case 'deploy':
        handleResourceTypeChange('deployments');
        break;
      case 'services':
      case 'svc':
        handleResourceTypeChange('services');
        break;
      case 'configmaps':
      case 'cm':
        handleResourceTypeChange('configmaps');
        break;
      case 'secrets':
      case 'sec':
        handleResourceTypeChange('secrets');
        break;
      case 'nodes':
      case 'no':
        handleResourceTypeChange('nodes');
        break;
      case 'events':
      case 'ev':
        handleResourceTypeChange('events');
        break;
      case 'jobs':
        handleResourceTypeChange('jobs');
        break;
      case 'cronjobs':
      case 'cj':
        handleResourceTypeChange('cronjobs');
        break;
      case 'ingresses':
      case 'ing':
        handleResourceTypeChange('ingresses');
        break;
      case 'statefulsets':
      case 'sts':
        handleResourceTypeChange('statefulsets');
        break;
      case 'daemonsets':
      case 'ds':
        handleResourceTypeChange('daemonsets');
        break;
      case 'pvc':
        handleResourceTypeChange('persistentvolumeclaims');
        break;
      case 'pv':
        handleResourceTypeChange('persistentvolumes');
        break;
      case 'sa':
        handleResourceTypeChange('serviceaccounts');
        break;
      case 'ep':
        handleResourceTypeChange('endpoints');
        break;
      case 'rs':
        handleResourceTypeChange('replicasets');
        break;
      case 'ns':
        if (args[0] && namespaces.includes(args[0])) {
          handleNamespaceChange(args[0]);
        }
        break;
      case 'ctx':
        if (args[0] && contexts.includes(args[0])) {
          switchContext(args[0]);
        }
        break;
      case 'q':
      case 'quit':
        handleDisconnect();
        break;
      case 'pulse':
        setShowPulse(true);
        break;
      case 'pf':
        setPortForwardDialog({ mode: 'list' });
        break;
      case 'all':
        loadAllResourceTypes();
        setShowAllResources(true);
        break;
    }
    
    setShowCommandPalette(false);
    setCommand('');
  }, [handleResourceTypeChange, handleNamespaceChange, switchContext, handleDisconnect, namespaces, contexts, loadAllResourceTypes]);

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className={`flex h-full ${theme.bg} ${theme.text} -m-4 rounded-lg overflow-hidden`}>
      {/* Sidebar */}
      <div className={`w-56 flex-shrink-0 ${theme.sidebar} border-r ${theme.border} flex flex-col`}>
        {/* Connection selector */}
        <div className={`p-3 border-b ${theme.border}`}>
          <select
            value={selectedId}
            onChange={(e) => handleQuickConnect(e.target.value)}
            className={`w-full px-2 py-1.5 text-sm ${theme.input} border rounded focus:outline-none focus:border-blue-500`}
          >
            <option value="">Select cluster...</option>
            {k8sConnections.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          
          {selectedId && (
            <div className="mt-2 flex items-center gap-2">
              {status === 'disconnected' ? (
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center gap-1"
                >
                  {loading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                  Connect
                </button>
              ) : (
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="flex-1 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded flex items-center justify-center gap-1"
                >
                  <Square size={12} /> Disconnect
                </button>
              )}
              <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-gray-500'}`} />
            </div>
          )}
        </div>
        
        {/* Context & Namespace */}
        {status === 'connected' && (
          <div className={`p-3 border-b ${theme.border} space-y-2`}>
            <div>
              <label className={`block text-xs ${theme.textFaint} mb-1`}>Context</label>
              <select
                value={currentContext}
                onChange={(e) => switchContext(e.target.value)}
                className={`w-full px-2 py-1 text-xs ${theme.input} border rounded`}
              >
                {contexts.map(ctx => (
                  <option key={ctx} value={ctx}>{ctx}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`text-xs ${theme.textFaint}`}>Namespace</label>
                <button
                  onClick={toggleAllNamespaces}
                  className={`text-xs px-1.5 rounded ${allNamespaces ? 'bg-blue-600 text-white' : `${theme.textMuted} hover:${theme.text}`}`}
                >
                  All
                </button>
              </div>
              <select
                value={namespace}
                onChange={(e) => handleNamespaceChange(e.target.value)}
                disabled={allNamespaces}
                className={`w-full px-2 py-1 text-xs ${theme.input} border rounded disabled:opacity-50`}
              >
                {namespaces.map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        
        {/* Resource navigation */}
        {status === 'connected' && (
          <div className="flex-1 overflow-auto py-2">
            {Object.entries(RESOURCE_GROUPS).map(([key, group]) => (
              <div key={key} className="mb-1">
                <button
                  onClick={() => toggleGroup(key)}
                  className={`w-full px-3 py-1 flex items-center gap-2 text-xs ${theme.textMuted} ${theme.hover}`}
                >
                  {expandedGroups[key] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <group.icon size={12} />
                  {group.label}
                </button>
                
                {expandedGroups[key] && (
                  <div className="ml-4">
                    {group.resources.map(res => {
                      const Icon = RESOURCE_ICONS[res] || Box;
                      return (
                        <button
                          key={res}
                          onClick={() => handleResourceTypeChange(res)}
                          className={`w-full px-3 py-1 flex items-center gap-2 text-xs rounded-l ${
                            resourceType === res
                              ? theme.active
                              : `${theme.text} ${theme.hover}`
                          }`}
                        >
                          <Icon size={12} />
                          {res}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Pulse button */}
        {status === 'connected' && (
          <button
            onClick={() => setShowPulse(p => !p)}
            className={`mx-2 mb-2 flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded ${
              showPulse ? 'bg-red-500 text-white' : theme.button
            }`}
            title="Cluster Pulse (Shift+P)"
          >
            <Heart size={14} />
            Pulse
          </button>
        )}
        
        {/* Quick Actions */}
        <div className={`p-2 border-t ${theme.border} space-y-1`}>
          <div className={`text-xs font-medium ${theme.textMuted} mb-2`}>Quick Actions</div>
          
          <button
            onClick={() => setShowCommandPalette(true)}
            className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded ${theme.button}`}
            title="Open command palette"
          >
            <span className="flex items-center gap-2">
              <Terminal size={12} /> Command
            </span>
            <kbd className={`px-1.5 py-0.5 text-[10px] rounded ${themeName === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>:</kbd>
          </button>
          
          <button
            onClick={() => loadResources(resourceType)}
            className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded ${theme.button}`}
            title="Refresh resources"
          >
            <span className="flex items-center gap-2">
              <RefreshCw size={12} /> Refresh
            </span>
            <kbd className={`px-1.5 py-0.5 text-[10px] rounded ${themeName === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>Ctrl+R</kbd>
          </button>
          
          <button
            onClick={() => { loadAllResourceTypes(); setShowAllResources(true); }}
            className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded ${theme.button}`}
            title="Browse all resource types"
          >
            <span className="flex items-center gap-2">
              <Layers size={12} /> All Resources
            </span>
            <kbd className={`px-1.5 py-0.5 text-[10px] rounded ${themeName === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}>Ctrl+A</kbd>
          </button>
          
          <div className={`my-2 border-t ${theme.border}`} />
          
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-center gap-2 px-2 py-2 text-sm rounded-md ${
              themeName === 'dark' 
                ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400' 
                : 'bg-gray-700/10 hover:bg-gray-700/20 text-gray-700'
            } transition-colors`}
            title="Toggle theme"
          >
            {themeName === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {themeName === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 ${theme.header} border-b ${theme.border}`}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium">
              {resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}
            </h2>
            {!allNamespaces && namespace && (
              <span className={`text-xs ${theme.textFaint}`}>in {namespace}</span>
            )}
            {allNamespaces && (
              <span className="text-xs text-blue-400">all namespaces</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                autoRefresh ? 'bg-green-600 text-white' : theme.button
              }`}
              title={autoRefresh ? `Auto-refresh ON (${refreshInterval/1000}s)` : 'Auto-refresh OFF'}
            >
              {autoRefresh ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              Auto
            </button>
            
            {/* Metrics toggle */}
            {(resourceType === 'pods' || resourceType === 'nodes') && (
              <button
                onClick={() => setShowMetrics(m => !m)}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                  showMetrics ? 'bg-purple-600 text-white' : theme.button
                }`}
                title="Toggle metrics"
              >
                <Cpu size={14} />
                Metrics
              </button>
            )}
            
            {/* Port forwards indicator */}
            {portForwards.length > 0 && (
              <button
                onClick={() => setPortForwardDialog({ mode: 'list' })}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded"
                title="Active port forwards"
              >
                <Share2 size={14} />
                {portForwards.length} PF
              </button>
            )}
            
            {selectedConnection && (
              <ConnectionBadge connection={selectedConnection} status={status} />
            )}
          </div>
        </div>
        
        {/* Content area */}
        <div className="flex-1 flex flex-col min-h-0">
          {status !== 'connected' ? (
            <div className={`flex-1 flex items-center justify-center ${theme.textFaint}`}>
              <div className="text-center">
                <Server size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No cluster connected</p>
                <p className="text-sm">Select a Kubernetes connection and click Connect</p>
                <div className={`mt-4 p-4 rounded ${theme.panel} border ${theme.border} text-left text-xs max-w-md`}>
                  <p className="font-medium mb-2">Configuration:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to Connections → New Connection</li>
                    <li>Select type: <strong>Kubernetes</strong></li>
                    <li>Choose kubeconfig source:</li>
                    <ul className="ml-6 list-disc">
                      <li><strong>Default</strong> - uses ~/.kube/config</li>
                      <li><strong>Path</strong> - specify custom path</li>
                      <li><strong>Inline</strong> - paste kubeconfig YAML</li>
                    </ul>
                    <li>Optionally set context and default namespace</li>
                    <li>Save and connect</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : showPulse ? (
            <K8sPulseView
              pulse={pulseData}
              loading={pulseLoading}
              onRefresh={loadPulse}
              onClose={() => setShowPulse(false)}
              theme={theme}
              className="flex-1"
            />
          ) : (
            <>
              {/* Resource table */}
              <div className={`flex-1 min-h-0 ${yamlPanel || terminalPanel ? 'h-1/2' : ''}`}>
                <K8sResourceTable
                  resourceType={resourceType}
                  items={resources}
                  loading={resourceLoading}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                  onAction={handleAction}
                  onRefresh={() => loadResources(resourceType)}
                  theme={theme}
                  className="h-full"
                />
              </div>
              
              {/* YAML Panel */}
              {yamlPanel && (
                <div className={`h-1/2 border-t ${theme.border}`}>
                  <K8sYamlViewer
                    yaml={yamlPanel.yaml}
                    resourceName={yamlPanel.name}
                    resourceType={yamlPanel.type}
                    namespace={yamlPanel.namespace}
                    onClose={() => setYamlPanel(null)}
                    readOnly={true}
                    className="h-full"
                  />
                </div>
              )}
              
              {/* Terminal Panel */}
              {terminalPanel && (
                <div className={`h-1/2 border-t ${theme.border}`}>
                  <K8sTerminal
                    connectionId={selectedId}
                    sessionId={terminalPanel.sessionId}
                    logId={terminalPanel.logId}
                    mode={terminalPanel.mode}
                    onInput={handleTerminalInput}
                    onClose={closeTerminal}
                    title={`${terminalPanel.mode === 'logs' ? 'Logs' : 'Shell'}: ${terminalPanel.pod}`}
                    className="h-full"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Command Palette */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-32 z-50">
          <div className={`${theme.panel} ${theme.text} rounded-lg shadow-xl w-96 overflow-hidden border ${theme.border}`}>
            <div className={`flex items-center px-3 py-2 border-b ${theme.border}`}>
              <span className={`${theme.textMuted} mr-2`}>:</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeCommand(command);
                  if (e.key === 'Escape') { setShowCommandPalette(false); setCommand(''); }
                }}
                placeholder="pods, deploy, svc, ns <name>, ctx <name>, q"
                className={`flex-1 bg-transparent ${theme.text} focus:outline-none`}
                autoFocus
              />
            </div>
            <div className={`p-2 text-xs ${theme.textFaint}`}>
              <div>pods/po, deploy, svc, cm, sec, no, events, jobs, cronjobs, ing</div>
              <div>ns &lt;name&gt; | ctx &lt;name&gt; | pulse | pf | all | q</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Scale Dialog */}
      {scaleDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.panel} ${theme.text} rounded-lg shadow-xl w-80 p-4 border ${theme.border}`}>
            <h3 className="text-sm font-medium mb-4">Scale {scaleDialog.name}</h3>
            <div className="mb-4">
              <label className={`block text-xs ${theme.textMuted} mb-1`}>Replicas</label>
              <input
                type="number"
                min="0"
                defaultValue={scaleDialog.currentReplicas}
                className={`w-full px-3 py-2 ${theme.inputDark} border rounded`}
                id="scale-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setScaleDialog(null)}
                className={`px-3 py-1.5 text-sm ${theme.textMuted}`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleScale(parseInt(document.getElementById('scale-input').value, 10))}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Scale
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Port Forward Dialog */}
      {portForwardDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.panel} ${theme.text} rounded-lg shadow-xl w-96 p-4 border ${theme.border}`}>
            {portForwardDialog.mode === 'list' ? (
              <>
                <h3 className="text-sm font-medium mb-4">Active Port Forwards</h3>
                <div className="space-y-2 max-h-64 overflow-auto mb-4">
                  {portForwards.map(pf => (
                    <div key={pf.id} className={`flex items-center justify-between p-2 ${theme.inputDark} rounded`}>
                      <div>
                        <div className="text-sm">{pf.pod}</div>
                        <div className={`text-xs ${theme.textMuted}`}>localhost:{pf.localPort} → {pf.podPort}</div>
                      </div>
                      <button
                        onClick={() => stopPortForward(pf.id)}
                        className={`px-2 py-1 text-xs text-red-500 ${theme.hover} rounded`}
                      >
                        Stop
                      </button>
                    </div>
                  ))}
                  {portForwards.length === 0 && (
                    <div className={`text-sm ${theme.textFaint} text-center py-4`}>No active port forwards</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-medium mb-4">Port Forward to {portForwardDialog.pod}</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className={`block text-xs ${theme.textMuted} mb-1`}>Pod Port</label>
                    <input
                      type="number"
                      id="pf-pod-port"
                      placeholder="80"
                      className={`w-full px-3 py-2 ${theme.inputDark} border rounded`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${theme.textMuted} mb-1`}>Local Port (optional)</label>
                    <input
                      type="number"
                      id="pf-local-port"
                      placeholder="Same as pod port"
                      className={`w-full px-3 py-2 ${theme.inputDark} border rounded`}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPortForwardDialog(null)}
                className={`px-3 py-1.5 text-sm ${theme.textMuted}`}
              >
                Close
              </button>
              {portForwardDialog.mode !== 'list' && (
                <button
                  onClick={() => startPortForward(
                    portForwardDialog.pod,
                    document.getElementById('pf-pod-port').value,
                    document.getElementById('pf-local-port').value
                  )}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  Start
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Container Selector Dialog */}
      {containerDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.panel} ${theme.text} rounded-lg shadow-xl w-80 p-4 border ${theme.border}`}>
            <h3 className="text-sm font-medium mb-4">Select Container</h3>
            <div className="space-y-2 max-h-64 overflow-auto mb-4">
              {containerDialog.item.containers.map(c => (
                <button
                  key={c}
                  onClick={() => handleContainerSelect(c)}
                  className={`w-full text-left px-3 py-2 ${theme.inputDark} ${theme.hover} rounded text-sm`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setContainerDialog(null)}
                className={`px-3 py-1.5 text-sm ${theme.textMuted}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* All Resource Types Dialog */}
      {showAllResources && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.panel} ${theme.text} rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col border ${theme.border}`}>
            <div className={`px-4 py-3 border-b ${theme.border} flex items-center justify-between`}>
              <h3 className="text-sm font-medium">All Resource Types (Ctrl+A)</h3>
              <button
                onClick={() => setShowAllResources(false)}
                className={theme.textMuted}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {allResourceTypes.map(rt => (
                <button
                  key={rt.name}
                  onClick={() => {
                    handleResourceTypeChange(rt.name);
                    setShowAllResources(false);
                  }}
                  className={`w-full text-left px-3 py-2 ${theme.hover} rounded text-sm flex items-center justify-between`}
                >
                  <span>{rt.name}</span>
                  <span className={`text-xs ${theme.textFaint}`}>
                    {rt.namespaced ? 'namespaced' : 'cluster'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Node Action Dialog */}
      {nodeActionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme.panel} ${theme.text} rounded-lg shadow-xl w-96 p-4 border ${theme.border}`}>
            <h3 className="text-sm font-medium mb-4">Node: {nodeActionDialog.name}</h3>
            <div className="space-y-2 mb-4">
              <button
                onClick={() => handleNodeAction('cordon', nodeActionDialog.name)}
                className={`w-full text-left px-3 py-2 ${theme.inputDark} ${theme.hover} rounded text-sm flex items-center gap-2`}
              >
                <Ban size={16} className="text-yellow-500" />
                Cordon (mark unschedulable)
              </button>
              <button
                onClick={() => handleNodeAction('uncordon', nodeActionDialog.name)}
                className={`w-full text-left px-3 py-2 ${theme.inputDark} ${theme.hover} rounded text-sm flex items-center gap-2`}
              >
                <CheckCircle2 size={16} className="text-green-500" />
                Uncordon (mark schedulable)
              </button>
              <button
                onClick={() => {
                  if (confirm(`Drain node ${nodeActionDialog.name}? This will evict all pods.`)) {
                    handleNodeAction('drain', nodeActionDialog.name, { ignoreDaemonSets: true });
                  }
                }}
                className={`w-full text-left px-3 py-2 ${theme.inputDark} ${theme.hover} rounded text-sm flex items-center gap-2`}
              >
                <Trash2 size={16} className="text-red-500" />
                Drain (evict pods & cordon)
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setNodeActionDialog(null)}
                className={`px-3 py-1.5 text-sm ${theme.textMuted}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
