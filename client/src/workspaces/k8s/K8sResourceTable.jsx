// client/src/workspaces/k8s/K8sResourceTable.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  ArrowUp, ArrowDown, Search, RefreshCw, Trash2, FileText, 
  Terminal, Scale, RotateCcw, ChevronUp, ChevronDown, Share2
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
  className = '',
}) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const tableRef = useRef(null);
  const rowRefs = useRef({});

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

  return (
    <div className={`flex flex-col h-full ${className}`} ref={tableRef} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="k8s-filter-input"
            type="text"
            placeholder="Filter... (press / to focus)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-7 pr-3 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        
        <span className="text-xs text-gray-500">
          {filteredItems.length} / {items.length} items
        </span>
        
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-50"
          title="Refresh (Ctrl+R)"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Action bar */}
      {selectedItem && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-750 border-b border-gray-700 text-xs">
          <span className="text-gray-400 mr-2">Actions:</span>
          
          <button
            onClick={() => onAction?.('describe', selectedItem)}
            className="px-2 py-0.5 text-gray-300 hover:bg-gray-700 rounded flex items-center gap-1"
            title="Describe (Enter)"
          >
            <FileText size={12} /> Describe
          </button>
          
          {resourceType === 'pods' && (
            <>
              <button
                onClick={() => onAction?.('logs', selectedItem)}
                className="px-2 py-0.5 text-gray-300 hover:bg-gray-700 rounded flex items-center gap-1"
                title="Logs (l)"
              >
                <FileText size={12} /> Logs
              </button>
              <button
                onClick={() => onAction?.('shell', selectedItem)}
                className="px-2 py-0.5 text-gray-300 hover:bg-gray-700 rounded flex items-center gap-1"
                title="Shell (s)"
              >
                <Terminal size={12} /> Shell
              </button>
              <button
                onClick={() => onAction?.('portForward', selectedItem)}
                className="px-2 py-0.5 text-gray-300 hover:bg-gray-700 rounded flex items-center gap-1"
                title="Port Forward (p)"
              >
                <Share2 size={12} /> Port Forward
              </button>
            </>
          )}
          
          {['deployments', 'statefulsets', 'replicasets'].includes(resourceType) && (
            <>
              <button
                onClick={() => onAction?.('scale', selectedItem)}
                className="px-2 py-0.5 text-gray-300 hover:bg-gray-700 rounded flex items-center gap-1"
              >
                <Scale size={12} /> Scale
              </button>
              {resourceType === 'deployments' && (
                <button
                  onClick={() => onAction?.('restart', selectedItem)}
                  className="px-2 py-0.5 text-gray-300 hover:bg-gray-700 rounded flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Restart
                </button>
              )}
            </>
          )}
          
          <button
            onClick={() => onAction?.('delete', selectedItem)}
            className="px-2 py-0.5 text-red-400 hover:bg-gray-700 rounded flex items-center gap-1 ml-auto"
            title="Delete (Ctrl+D)"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-800">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className="px-2 py-1.5 text-left text-gray-400 font-medium cursor-pointer hover:bg-gray-700 select-none"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-2 py-8 text-center text-gray-500">
                  <RefreshCw size={16} className="inline animate-spin mr-2" />
                  Loading...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-2 py-8 text-center text-gray-500">
                  {filter ? 'No matching resources' : 'No resources found'}
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
                    cursor-pointer border-b border-gray-800
                    ${index === selectedIndex 
                      ? 'bg-blue-900/50 text-white' 
                      : 'hover:bg-gray-800/50 text-gray-300'}
                  `}
                >
                  {columns.map((col) => (
                    <td 
                      key={col.key} 
                      className={`px-2 py-1 truncate ${
                        col.key === 'status' || col.key === 'phase' 
                          ? getStatusColor(item[col.key]) 
                          : ''
                      }`}
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

      {/* Status bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        <span>
          {selectedIndex >= 0 ? `${selectedIndex + 1}/${filteredItems.length}` : '-'}
        </span>
        <span className="flex items-center gap-3">
          <span>↑↓/jk: Navigate</span>
          <span>Enter: Describe</span>
          {resourceType === 'pods' && <span>l: Logs</span>}
          {resourceType === 'pods' && <span>s: Shell</span>}
          <span>/: Filter</span>
        </span>
      </div>
    </div>
  );
}
