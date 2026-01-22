// client/src/workspaces/k8s/K8sResourceTable.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  Search, RefreshCw, Trash2, FileText, 
  Terminal, Scale, RotateCcw, ChevronUp, ChevronDown, Share2, Settings2,
  Eye, Play, MoreHorizontal, Copy, Download, Edit3
} from 'lucide-react';

// Column definitions for each resource type
const RESOURCE_COLUMNS = {
  pods: [
    { key: 'name', label: 'NAME', width: '25%' },
    { key: 'namespace', label: 'NAMESPACE', width: '12%' },
    { key: 'ready', label: 'READY', width: '8%' },
    { key: 'status', label: 'STATUS', width: '10%' },
    { key: 'restarts', label: 'RESTARTS', width: '8%' },
    { key: 'age', label: 'AGE', width: '8%' },
    { key: 'ip', label: 'IP', width: '12%' },
    { key: 'node', label: 'NODE', width: '17%' },
  ],
  deployments: [
    { key: 'name', label: 'NAME', width: '30%' },
    { key: 'namespace', label: 'NAMESPACE', width: '15%' },
    { key: 'ready', label: 'READY', width: '10%' },
    { key: 'upToDate', label: 'UP-TO-DATE', width: '10%' },
    { key: 'available', label: 'AVAILABLE', width: '10%' },
    { key: 'age', label: 'AGE', width: '10%' },
    { key: 'images', label: 'IMAGES', width: '15%' },
  ],
  services: [
    { key: 'name', label: 'NAME', width: '20%' },
    { key: 'namespace', label: 'NAMESPACE', width: '12%' },
    { key: 'type', label: 'TYPE', width: '12%' },
    { key: 'clusterIP', label: 'CLUSTER-IP', width: '15%' },
    { key: 'externalIP', label: 'EXTERNAL-IP', width: '15%' },
    { key: 'ports', label: 'PORTS', width: '18%' },
    { key: 'age', label: 'AGE', width: '8%' },
  ],
  configmaps: [
    { key: 'name', label: 'NAME', width: '40%' },
    { key: 'namespace', label: 'NAMESPACE', width: '25%' },
    { key: 'data', label: 'DATA', width: '15%' },
    { key: 'age', label: 'AGE', width: '20%' },
  ],
  secrets: [
    { key: 'name', label: 'NAME', width: '35%' },
    { key: 'namespace', label: 'NAMESPACE', width: '20%' },
    { key: 'type', label: 'TYPE', width: '25%' },
    { key: 'data', label: 'DATA', width: '10%' },
    { key: 'age', label: 'AGE', width: '10%' },
  ],
  nodes: [
    { key: 'name', label: 'NAME', width: '20%' },
    { key: 'status', label: 'STATUS', width: '10%' },
    { key: 'roles', label: 'ROLES', width: '15%' },
    { key: 'age', label: 'AGE', width: '8%' },
    { key: 'version', label: 'VERSION', width: '12%' },
    { key: 'internalIP', label: 'INTERNAL-IP', width: '15%' },
    { key: 'os', label: 'OS-IMAGE', width: '20%' },
  ],
  events: [
    { key: 'namespace', label: 'NAMESPACE', width: '12%' },
    { key: 'lastSeen', label: 'LAST SEEN', width: '10%' },
    { key: 'type', label: 'TYPE', width: '8%' },
    { key: 'reason', label: 'REASON', width: '12%' },
    { key: 'object', label: 'OBJECT', width: '18%' },
    { key: 'message', label: 'MESSAGE', width: '40%' },
  ],
  namespaces: [
    { key: 'name', label: 'NAME', width: '50%' },
    { key: 'status', label: 'STATUS', width: '25%' },
    { key: 'age', label: 'AGE', width: '25%' },
  ],
  statefulsets: [
    { key: 'name', label: 'NAME', width: '35%' },
    { key: 'namespace', label: 'NAMESPACE', width: '25%' },
    { key: 'ready', label: 'READY', width: '20%' },
    { key: 'age', label: 'AGE', width: '20%' },
  ],
  daemonsets: [
    { key: 'name', label: 'NAME', width: '25%' },
    { key: 'namespace', label: 'NAMESPACE', width: '15%' },
    { key: 'desired', label: 'DESIRED', width: '10%' },
    { key: 'current', label: 'CURRENT', width: '10%' },
    { key: 'ready', label: 'READY', width: '10%' },
    { key: 'upToDate', label: 'UP-TO-DATE', width: '10%' },
    { key: 'available', label: 'AVAILABLE', width: '10%' },
    { key: 'age', label: 'AGE', width: '10%' },
  ],
  jobs: [
    { key: 'name', label: 'NAME', width: '35%' },
    { key: 'namespace', label: 'NAMESPACE', width: '20%' },
    { key: 'completions', label: 'COMPLETIONS', width: '15%' },
    { key: 'duration', label: 'DURATION', width: '15%' },
    { key: 'age', label: 'AGE', width: '15%' },
  ],
  cronjobs: [
    { key: 'name', label: 'NAME', width: '25%' },
    { key: 'namespace', label: 'NAMESPACE', width: '15%' },
    { key: 'schedule', label: 'SCHEDULE', width: '15%' },
    { key: 'suspend', label: 'SUSPEND', width: '10%' },
    { key: 'active', label: 'ACTIVE', width: '10%' },
    { key: 'lastSchedule', label: 'LAST SCHEDULE', width: '15%' },
    { key: 'age', label: 'AGE', width: '10%' },
  ],
  ingresses: [
    { key: 'name', label: 'NAME', width: '20%' },
    { key: 'namespace', label: 'NAMESPACE', width: '15%' },
    { key: 'class', label: 'CLASS', width: '15%' },
    { key: 'hosts', label: 'HOSTS', width: '20%' },
    { key: 'address', label: 'ADDRESS', width: '15%' },
    { key: 'ports', label: 'PORTS', width: '8%' },
    { key: 'age', label: 'AGE', width: '7%' },
  ],
  persistentvolumeclaims: [
    { key: 'name', label: 'NAME', width: '20%' },
    { key: 'namespace', label: 'NAMESPACE', width: '15%' },
    { key: 'status', label: 'STATUS', width: '10%' },
    { key: 'volume', label: 'VOLUME', width: '20%' },
    { key: 'capacity', label: 'CAPACITY', width: '10%' },
    { key: 'accessModes', label: 'ACCESS MODES', width: '15%' },
    { key: 'age', label: 'AGE', width: '10%' },
  ],
  persistentvolumes: [
    { key: 'name', label: 'NAME', width: '20%' },
    { key: 'capacity', label: 'CAPACITY', width: '10%' },
    { key: 'accessModes', label: 'ACCESS MODES', width: '15%' },
    { key: 'reclaimPolicy', label: 'RECLAIM POLICY', width: '12%' },
    { key: 'status', label: 'STATUS', width: '10%' },
    { key: 'claim', label: 'CLAIM', width: '18%' },
    { key: 'age', label: 'AGE', width: '10%' },
  ],
  replicasets: [
    { key: 'name', label: 'NAME', width: '35%' },
    { key: 'namespace', label: 'NAMESPACE', width: '20%' },
    { key: 'desired', label: 'DESIRED', width: '12%' },
    { key: 'current', label: 'CURRENT', width: '12%' },
    { key: 'ready', label: 'READY', width: '11%' },
    { key: 'age', label: 'AGE', width: '10%' },
  ],
  endpoints: [
    { key: 'name', label: 'NAME', width: '30%' },
    { key: 'namespace', label: 'NAMESPACE', width: '20%' },
    { key: 'endpoints', label: 'ENDPOINTS', width: '40%' },
    { key: 'age', label: 'AGE', width: '10%' },
  ],
  serviceaccounts: [
    { key: 'name', label: 'NAME', width: '40%' },
    { key: 'namespace', label: 'NAMESPACE', width: '30%' },
    { key: 'secrets', label: 'SECRETS', width: '15%' },
    { key: 'age', label: 'AGE', width: '15%' },
  ],
};

// Status color mapping
const getStatusColor = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'running' || s === 'ready' || s === 'active' || s === 'bound') return 'text-green-400';
  if (s === 'pending' || s === 'waiting') return 'text-yellow-400';
  if (s === 'failed' || s === 'error' || s === 'crashloopbackoff') return 'text-red-400';
  if (s === 'terminating' || s === 'deleting') return 'text-orange-400';
  if (s === 'succeeded' || s === 'completed') return 'text-blue-400';
  return 'text-gray-400';
};

/**
 * K8sResourceTable - k9s-like resource table with keyboard navigation
 */
export default function K8sResourceTable({
  resourceType,
  items = [],
  loading = false,
  selectedIndex = -1,
  onSelect,
  onAction,
  onRefresh,
  theme = {},
  className = '',
}) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const tableRef = useRef(null);
  const rowRefs = useRef({});

  // Theme-aware colors (fallback for backwards compatibility)
  const isDark = theme.bg?.includes('gray-900') || !theme.bg;
  const colors = {
    bg: isDark ? 'bg-gray-900' : 'bg-white',
    headerBg: isDark ? 'bg-gray-800' : 'bg-gray-100',
    toolbarBg: isDark ? 'bg-gray-800' : 'bg-gray-50',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    text: isDark ? 'text-gray-200' : 'text-gray-900',
    textMuted: isDark ? 'text-gray-400' : 'text-gray-600',
    textFaint: isDark ? 'text-gray-500' : 'text-gray-500',
    hover: isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100',
    selected: isDark ? 'bg-blue-900/50' : 'bg-blue-100',
    input: isDark ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-900',
    button: isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonDanger: isDark ? 'bg-red-600/20 hover:bg-red-600/40 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-600',
  };

  const columns = RESOURCE_COLUMNS[resourceType] || RESOURCE_COLUMNS.pods;

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = items;
    
    // Filter
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter(item => 
        Object.values(item).some(val => 
          String(val).toLowerCase().includes(lowerFilter)
        )
      );
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [items, filter, sortKey, sortDir]);

  // Handle column header click for sorting
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Scroll selected row into view
  useEffect(() => {
    if (selectedIndex >= 0 && rowRefs.current[selectedIndex]) {
      rowRefs.current[selectedIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!tableRef.current?.contains(document.activeElement) && 
          document.activeElement?.tagName !== 'INPUT') {
        return;
      }

      const maxIndex = filteredItems.length - 1;

      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          onSelect?.(Math.max(0, selectedIndex - 1));
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          onSelect?.(Math.min(maxIndex, selectedIndex + 1));
          break;
        case 'Home':
        case 'g':
          if (e.key === 'g' && !e.ctrlKey) break;
          e.preventDefault();
          onSelect?.(0);
          break;
        case 'End':
        case 'G':
          e.preventDefault();
          onSelect?.(maxIndex);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
            onAction?.('describe', filteredItems[selectedIndex]);
          }
          break;
        case 'l':
          e.preventDefault();
          if (selectedIndex >= 0 && filteredItems[selectedIndex] && resourceType === 'pods') {
            onAction?.('logs', filteredItems[selectedIndex]);
          }
          break;
        case 's':
          e.preventDefault();
          if (selectedIndex >= 0 && filteredItems[selectedIndex] && resourceType === 'pods') {
            onAction?.('shell', filteredItems[selectedIndex]);
          }
          break;
        case 'd':
          if (e.ctrlKey) {
            e.preventDefault();
            if (selectedIndex >= 0 && filteredItems[selectedIndex]) {
              onAction?.('delete', filteredItems[selectedIndex]);
            }
          }
          break;
        case '/':
          e.preventDefault();
          document.getElementById('k8s-filter-input')?.focus();
          break;
        case 'Escape':
          setFilter('');
          tableRef.current?.focus();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredItems, onSelect, onAction, resourceType]);

  const selectedItem = selectedIndex >= 0 ? filteredItems[selectedIndex] : null;

  // Copy resource name to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className={`flex flex-col h-full ${className}`} ref={tableRef} tabIndex={0}>
      {/* Main Toolbar */}
      <div className={`flex items-center gap-3 px-3 py-2 ${colors.toolbarBg} border-b ${colors.border}`}>
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${colors.textFaint}`} />
          <input
            id="k8s-filter-input"
            type="text"
            placeholder="Filter resources... ( / )"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`w-full pl-8 pr-3 py-1.5 text-sm ${colors.input} border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
        
        {/* Resource count badge */}
        <div className={`px-2.5 py-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-md text-xs font-medium ${colors.text}`}>
          {filteredItems.length} <span className={colors.textMuted}>/ {items.length}</span>
        </div>
        
        {/* Quick Action Buttons - always visible */}
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`p-2 rounded-md ${colors.button} disabled:opacity-50 transition-colors`}
            title="Refresh (Ctrl+R)"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Action Toolbar - shown when item is selected */}
      {selectedItem && (
        <div className={`flex items-center gap-2 px-3 py-2 ${isDark ? 'bg-gray-800/80' : 'bg-blue-50'} border-b ${colors.border}`}>
          {/* Selected item info */}
          <div className="flex items-center gap-2 mr-2">
            <span className={`text-xs font-medium ${colors.textMuted}`}>Selected:</span>
            <span className={`text-sm font-mono ${colors.text}`}>{selectedItem.name}</span>
            <button
              onClick={() => copyToClipboard(selectedItem.name)}
              className={`p-1 rounded ${colors.hover}`}
              title="Copy name"
            >
              <Copy size={12} className={colors.textMuted} />
            </button>
          </div>
          
          <div className={`w-px h-5 ${colors.border}`} />
          
          {/* Common Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAction?.('describe', selectedItem)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${colors.buttonPrimary} transition-colors`}
              title="Describe (Enter)"
            >
              <Eye size={14} /> View YAML
            </button>
            
            {resourceType === 'pods' && (
              <>
                <button
                  onClick={() => onAction?.('logs', selectedItem)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${colors.button} transition-colors`}
                  title="Logs (l)"
                >
                  <FileText size={14} /> Logs
                </button>
                <button
                  onClick={() => onAction?.('shell', selectedItem)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${colors.button} transition-colors`}
                  title="Shell (s)"
                >
                  <Terminal size={14} /> Shell
                </button>
                <button
                  onClick={() => onAction?.('portForward', selectedItem)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${colors.button} transition-colors`}
                  title="Port Forward"
                >
                  <Share2 size={14} /> Port Forward
                </button>
              </>
            )}
            
            {['deployments', 'statefulsets', 'replicasets'].includes(resourceType) && (
              <>
                <button
                  onClick={() => onAction?.('scale', selectedItem)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${colors.button} transition-colors`}
                  title="Scale replicas"
                >
                  <Scale size={14} /> Scale
                </button>
                {resourceType === 'deployments' && (
                  <button
                    onClick={() => onAction?.('restart', selectedItem)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${colors.button} transition-colors`}
                    title="Rolling restart"
                  >
                    <RotateCcw size={14} /> Restart
                  </button>
                )}
              </>
            )}
            
            {resourceType === 'nodes' && (
              <button
                onClick={() => onAction?.('nodeAction', selectedItem)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${isDark ? 'bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400' : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'} transition-colors`}
                title="Node management actions"
              >
                <Settings2 size={14} /> Manage Node
              </button>
            )}
          </div>
          
          {/* Spacer */}
          <div className="flex-1" />
          
          {/* Danger zone */}
          <button
            onClick={() => onAction?.('delete', selectedItem)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md ${colors.buttonDanger} transition-colors`}
            title="Delete (Ctrl+D)"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className={`sticky top-0 ${colors.headerBg} z-10`}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={`px-3 py-2 text-left ${colors.textMuted} font-semibold text-xs uppercase tracking-wide cursor-pointer ${colors.hover} select-none transition-colors`}
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-blue-500">
                        {sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={colors.text}>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={`px-3 py-12 text-center ${colors.textMuted}`}>
                  <RefreshCw size={20} className="inline animate-spin mr-2" />
                  Loading resources...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={`px-3 py-12 text-center ${colors.textMuted}`}>
                  {filter ? 'No matching resources found' : 'No resources in this namespace'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => (
                <tr
                  key={item.name + '-' + (item.namespace || '')}
                  ref={(el) => (rowRefs.current[index] = el)}
                  onClick={() => onSelect?.(index)}
                  onDoubleClick={() => onAction?.('describe', item)}
                  className={`
                    cursor-pointer border-b ${colors.border} transition-colors
                    ${index === selectedIndex 
                      ? `${colors.selected} font-medium` 
                      : colors.hover}
                  `}
                >
                  {columns.map((col) => (
                    <td 
                      key={col.key} 
                      className={`px-3 py-2 truncate ${
                        col.key === 'status' || col.key === 'phase' 
                          ? getStatusColor(item[col.key]) 
                          : ''
                      } ${col.key === 'name' ? 'font-mono' : ''}`}
                      title={String(item[col.key] ?? '')}
                    >
                      {item[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Enhanced Status Bar */}
      <div className={`flex items-center justify-between px-3 py-2 ${colors.headerBg} border-t ${colors.border}`}>
        {/* Position indicator */}
        <div className={`flex items-center gap-2 text-sm ${colors.textMuted}`}>
          <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'} font-mono text-xs`}>
            {selectedIndex >= 0 ? `${selectedIndex + 1}/${filteredItems.length}` : '—'}
          </span>
        </div>
        
        {/* Keyboard shortcuts as clickable buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => selectedIndex > 0 && onSelect?.(selectedIndex - 1)}
            className={`px-2 py-1 text-xs rounded ${colors.button} flex items-center gap-1`}
            title="Previous (↑ or k)"
          >
            <span className="font-mono">↑</span>
          </button>
          <button
            onClick={() => selectedIndex < filteredItems.length - 1 && onSelect?.(selectedIndex + 1)}
            className={`px-2 py-1 text-xs rounded ${colors.button} flex items-center gap-1`}
            title="Next (↓ or j)"
          >
            <span className="font-mono">↓</span>
          </button>
          
          <div className={`w-px h-4 mx-1 ${colors.border}`} />
          
          <button
            onClick={() => selectedItem && onAction?.('describe', selectedItem)}
            disabled={!selectedItem}
            className={`px-2 py-1 text-xs rounded ${colors.button} disabled:opacity-40 flex items-center gap-1`}
            title="Describe (Enter)"
          >
            <Eye size={12} /> <span className="hidden sm:inline">View</span>
            <kbd className={`ml-1 px-1 py-0.5 text-[10px] rounded ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>↵</kbd>
          </button>
          
          {resourceType === 'pods' && (
            <>
              <button
                onClick={() => selectedItem && onAction?.('logs', selectedItem)}
                disabled={!selectedItem}
                className={`px-2 py-1 text-xs rounded ${colors.button} disabled:opacity-40 flex items-center gap-1`}
                title="Logs (l)"
              >
                <FileText size={12} /> <span className="hidden sm:inline">Logs</span>
                <kbd className={`ml-1 px-1 py-0.5 text-[10px] rounded ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>l</kbd>
              </button>
              <button
                onClick={() => selectedItem && onAction?.('shell', selectedItem)}
                disabled={!selectedItem}
                className={`px-2 py-1 text-xs rounded ${colors.button} disabled:opacity-40 flex items-center gap-1`}
                title="Shell (s)"
              >
                <Terminal size={12} /> <span className="hidden sm:inline">Shell</span>
                <kbd className={`ml-1 px-1 py-0.5 text-[10px] rounded ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>s</kbd>
              </button>
            </>
          )}
          
          <div className={`w-px h-4 mx-1 ${colors.border}`} />
          
          <button
            onClick={() => document.getElementById('k8s-filter-input')?.focus()}
            className={`px-2 py-1 text-xs rounded ${colors.button} flex items-center gap-1`}
            title="Filter (/)"
          >
            <Search size={12} />
            <kbd className={`ml-1 px-1 py-0.5 text-[10px] rounded ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}>/</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
