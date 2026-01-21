// client/src/workspaces/k8s/K8sPulseView.jsx
// Cluster health overview panel (like k9s :pulse)
import React from 'react';
import { 
  Server, Box, Layers, Activity, AlertTriangle, Cpu, MemoryStick, 
  CheckCircle, XCircle, Clock, RefreshCw
} from 'lucide-react';

/**
 * K8sPulseView - Cluster health overview dashboard
 */
export default function K8sPulseView({ 
  pulse, 
  loading = false, 
  onRefresh, 
  onClose,
  theme,
  className = '' 
}) {
  if (!pulse) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <Activity size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm">Loading cluster pulse...</p>
        </div>
      </div>
    );
  }

  const { cluster, nodes, namespaces, pods, deployments, metrics, warnings } = pulse;

  const StatCard = ({ icon: Icon, label, value, subValue, color = 'blue' }) => (
    <div className={`p-4 rounded-lg ${theme?.panel || 'bg-white'} border ${theme?.border || 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${color}-100`}>
          <Icon size={20} className={`text-${color}-600`} />
        </div>
        <div>
          <div className={`text-2xl font-bold ${theme?.text || 'text-gray-900'}`}>{value}</div>
          <div className={`text-xs ${theme?.textMuted || 'text-gray-500'}`}>{label}</div>
          {subValue && <div className={`text-xs ${theme?.textFaint || 'text-gray-400'}`}>{subValue}</div>}
        </div>
      </div>
    </div>
  );

  const ProgressBar = ({ value, max, color = 'green' }) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full bg-${color}-500`} 
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  };

  return (
    <div className={`p-4 overflow-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-blue-500" />
          <div>
            <h2 className={`text-lg font-semibold ${theme?.text || 'text-gray-900'}`}>Cluster Pulse</h2>
            <div className={`text-xs ${theme?.textMuted || 'text-gray-500'}`}>
              Context: {cluster?.context} | K8s {cluster?.version}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`p-2 rounded ${theme?.button || 'text-gray-600 hover:bg-gray-100'}`}
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={`px-3 py-1 text-sm rounded ${theme?.button || 'text-gray-600 hover:bg-gray-100'}`}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard 
          icon={Server} 
          label="Nodes" 
          value={`${nodes?.ready}/${nodes?.total}`}
          subValue={nodes?.notReady > 0 ? `${nodes.notReady} not ready` : 'All healthy'}
          color={nodes?.notReady > 0 ? 'yellow' : 'green'}
        />
        <StatCard 
          icon={Box} 
          label="Pods" 
          value={pods?.running || 0}
          subValue={`${pods?.total} total`}
          color="blue"
        />
        <StatCard 
          icon={Layers} 
          label="Deployments" 
          value={`${deployments?.ready}/${deployments?.total}`}
          color={deployments?.ready === deployments?.total ? 'green' : 'yellow'}
        />
        <StatCard 
          icon={Layers} 
          label="Namespaces" 
          value={namespaces || 0}
          color="purple"
        />
      </div>

      {/* Pod Status Breakdown */}
      <div className={`p-4 rounded-lg ${theme?.panel || 'bg-white'} border ${theme?.border || 'border-gray-200'} mb-6`}>
        <h3 className={`text-sm font-medium mb-3 ${theme?.text || 'text-gray-900'}`}>Pod Status</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" />
              <span className={`text-sm ${theme?.text || 'text-gray-700'}`}>Running</span>
            </div>
            <span className={`text-sm font-medium ${theme?.text || 'text-gray-900'}`}>{pods?.running || 0}</span>
          </div>
          <ProgressBar value={pods?.running || 0} max={pods?.total || 1} color="green" />
          
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-yellow-500" />
              <span className={`text-sm ${theme?.text || 'text-gray-700'}`}>Pending</span>
            </div>
            <span className={`text-sm font-medium ${theme?.text || 'text-gray-900'}`}>{pods?.pending || 0}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle size={14} className="text-red-500" />
              <span className={`text-sm ${theme?.text || 'text-gray-700'}`}>Failed</span>
            </div>
            <span className={`text-sm font-medium ${theme?.text || 'text-gray-900'}`}>{pods?.failed || 0}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-blue-500" />
              <span className={`text-sm ${theme?.text || 'text-gray-700'}`}>Succeeded</span>
            </div>
            <span className={`text-sm font-medium ${theme?.text || 'text-gray-900'}`}>{pods?.succeeded || 0}</span>
          </div>
        </div>
      </div>

      {/* Metrics (if available) */}
      {metrics && (
        <div className={`p-4 rounded-lg ${theme?.panel || 'bg-white'} border ${theme?.border || 'border-gray-200'} mb-6`}>
          <h3 className={`text-sm font-medium mb-3 ${theme?.text || 'text-gray-900'}`}>Cluster Resources</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Cpu size={20} className="text-purple-500" />
              <div>
                <div className={`text-lg font-bold ${theme?.text || 'text-gray-900'}`}>{metrics.cpu}</div>
                <div className={`text-xs ${theme?.textMuted || 'text-gray-500'}`}>CPU Usage</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MemoryStick size={20} className="text-blue-500" />
              <div>
                <div className={`text-lg font-bold ${theme?.text || 'text-gray-900'}`}>{metrics.memory}</div>
                <div className={`text-xs ${theme?.textMuted || 'text-gray-500'}`}>Memory Usage</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Warnings */}
      {warnings && warnings.length > 0 && (
        <div className={`p-4 rounded-lg ${theme?.panel || 'bg-white'} border ${theme?.border || 'border-gray-200'}`}>
          <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${theme?.text || 'text-gray-900'}`}>
            <AlertTriangle size={16} className="text-yellow-500" />
            Recent Warnings ({warnings.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-auto">
            {warnings.map((w, i) => (
              <div key={i} className={`text-xs p-2 rounded ${theme?.inputDark || 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-yellow-600">{w.reason}</span>
                  <span className={theme?.textFaint || 'text-gray-400'}>{w.age}</span>
                </div>
                <div className={theme?.textMuted || 'text-gray-600'}>{w.object}</div>
                <div className={`mt-1 ${theme?.text || 'text-gray-700'}`}>{w.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
