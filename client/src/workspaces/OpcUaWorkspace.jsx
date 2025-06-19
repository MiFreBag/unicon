import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, 
  Wifi, 
  WifiOff, 
  Plus,
  X,
  Settings, 
  Eye,
  Edit3,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  Zap,
  MessageSquare,
  Code,
  Save,
  Trash2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Send,
  Play,
  Pause
} from 'lucide-react';

const UniversalTestClient = () => {
  const [connections, setConnections] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef(null);

  // API Base URLs
  const API_BASE = '/unicon/api';
  const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/unicon/ws`;

  // Connection types configuration
  const connectionTypes = {
    'opc-ua': {
      name: 'OPC UA',
      icon: <Server size={16} />,
      color: 'blue',
      fields: [
        { name: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'opc.tcp://localhost:4840', required: true },
        { name: 'securityMode', label: 'Security Mode', type: 'select', options: ['None', 'Sign', 'SignAndEncrypt'], default: 'None' },
        { name: 'securityPolicy', label: 'Security Policy', type: 'select', options: ['None', 'Basic128', 'Basic256'], default: 'None' }
      ]
    },
    'rest': {
      name: 'REST API',
      icon: <Globe size={16} />,
      color: 'green',
      fields: [
        { name: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com', required: true },
        { name: 'authentication', label: 'Authentication', type: 'select', options: ['None', 'Bearer Token', 'Basic Auth', 'API Key'], default: 'None' },
        { name: 'token', label: 'Token/Key', type: 'text', placeholder: 'Your API token' },
        { name: 'headers', label: 'Default Headers', type: 'textarea', placeholder: '{"Content-Type": "application/json"}' }
      ]
    },
    'websocket': {
      name: 'WebSocket',
      icon: <Zap size={16} />,
      color: 'yellow',
      fields: [
        { name: 'url', label: 'WebSocket URL', type: 'text', placeholder: 'ws://localhost:8080', required: true },
        { name: 'protocol', label: 'Sub-Protocol', type: 'text', placeholder: 'Optional sub-protocol' },
        { name: 'heartbeat', label: 'Heartbeat Interval (ms)', type: 'number', placeholder: '30000' }
      ]
    },
    'grpc': {
      name: 'gRPC',
      icon: <MessageSquare size={16} />,
      color: 'purple',
      fields: [
        { name: 'address', label: 'Server Address', type: 'text', placeholder: 'localhost:50051', required: true },
        { name: 'protoFile', label: 'Proto File Path', type: 'text', placeholder: '/path/to/service.proto' },
        { name: 'service', label: 'Service Name', type: 'text', placeholder: 'MyService' },
        { name: 'useTls', label: 'Use TLS', type: 'checkbox', default: false }
      ]
    },
    'cpd': {
      name: 'CPD Adapter',
      icon: <Code size={16} />,
      color: 'teal',
      fields: [
        { name: 'protocol', label: 'Protocol', type: 'select', options: ['grpc', 'websocket'], default: 'grpc', required: true },
        { name: 'address', label: 'gRPC Address', type: 'text', placeholder: 'localhost:8082', condition: { field: 'protocol', value: 'grpc' } },
        { name: 'url', label: 'WebSocket URL', type: 'text', placeholder: 'ws://localhost:8003', condition: { field: 'protocol', value: 'websocket' } },
        { name: 'useTls', label: 'Use TLS/WSS', type: 'checkbox', default: false },
        { name: 'defaultTopics', label: 'Default Topic Patterns', type: 'textarea', placeholder: 'sw.sensors.#\nsw.assets.#' }
      ]
    },
    'sql': {
      name: 'SQL Database',
      icon: <Database size={16} />,
      color: 'indigo',
      fields: [
        { name: 'type', label: 'Database Type', type: 'select', options: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server'], required: true },
        { name: 'host', label: 'Host', type: 'text', placeholder: 'localhost', required: true },
        { name: 'port', label: 'Port', type: 'number', placeholder: '5432' },
        { name: 'database', label: 'Database Name', type: 'text', placeholder: 'mydb', required: true },
        { name: 'username', label: 'Username', type: 'text', placeholder: 'user' },
        { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' }
      ]
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        wsRef.current = new WebSocket(WS_URL);
        
        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          addLog('WebSocket verbunden', 'success');
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          setTimeout(connectWebSocket, 3000);
        };
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();
    loadConnections();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'connection_status':
        updateConnectionStatus(message.data.connectionId, message.data.status);
        break;
      case 'log':
        addLog(message.data.message, message.data.type);
        break;
      case 'data':
        handleConnectionData(message.data);
        break;
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{
      id: Date.now(),
      message,
      type,
      timestamp
    }, ...prev.slice(0, 99)]);
  };

  const loadConnections = async () => {
    try {
      const response = await fetch(`${API_BASE}/connections`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const result = await response.json();
      if (result.success) {
        setConnections(result.connections || []);
      }
    } catch (error) {
      addLog(`Fehler beim Laden der Connections: ${error.message}`, 'error');
    }
  };

  const saveConnection = async (connectionData) => {
    try {
      const response = await fetch(`${API_BASE}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionData)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const result = await response.json();
      if (result.success) {
        setConnections(prev => [...prev, result.connection]);
        addLog(`Connection "${connectionData.name}" gespeichert`, 'success');
      }
    } catch (error) {
      addLog(`Fehler beim Speichern: ${error.message}`, 'error');
    }
  };

  const deleteConnection = async (connectionId) => {
    try {
      const response = await fetch(`${API_BASE}/connections/${connectionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      setConnections(prev => prev.filter(conn => conn.id !== connectionId));
      setOpenTabs(prev => prev.filter(tab => tab.id !== connectionId));
      if (activeTab === connectionId) {
        setActiveTab(openTabs.length > 1 ? openTabs[0].id : null);
      }
      addLog('Connection gelöscht', 'info');
    } catch (error) {
      addLog(`Fehler beim Löschen: ${error.message}`, 'error');
    }
  };

  const openConnection = (connection) => {
    if (!openTabs.find(tab => tab.id === connection.id)) {
      const newTab = {
        ...connection,
        status: 'disconnected',
        data: null
      };
      setOpenTabs(prev => [...prev, newTab]);
    }
    setActiveTab(connection.id);
  };

  const closeTab = (connectionId) => {
    setOpenTabs(prev => prev.filter(tab => tab.id !== connectionId));
    if (activeTab === connectionId) {
      const remainingTabs = openTabs.filter(tab => tab.id !== connectionId);
      setActiveTab(remainingTabs.length > 0 ? remainingTabs[0].id : null);
    }
  };

  const connectToService = async (connectionId) => {
    const connection = openTabs.find(tab => tab.id === connectionId);
    if (!connection) return;

    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId })
      });
      
      const result = await response.json();
      if (result.success) {
        updateConnectionStatus(connectionId, 'connected');
        addLog(`Verbunden mit ${connection.name}`, 'success');
      }
    } catch (error) {
      addLog(`Verbindung fehlgeschlagen: ${error.message}`, 'error');
      updateConnectionStatus(connectionId, 'disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectFromService = async (connectionId) => {
    try {
      const response = await fetch(`${API_BASE}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId })
      });
      
      if (response.ok) {
        updateConnectionStatus(connectionId, 'disconnected');
        addLog('Verbindung getrennt', 'info');
      }
    } catch (error) {
      addLog(`Fehler beim Trennen: ${error.message}`, 'error');
    }
  };

  const updateConnectionStatus = (connectionId, status) => {
    setOpenTabs(prev => prev.map(tab => 
      tab.id === connectionId ? { ...tab, status } : tab
    ));
  };

  const handleConnectionData = (data) => {
    setOpenTabs(prev => prev.map(tab => 
      tab.id === data.connectionId ? { ...tab, data: data.payload } : tab
    ));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="text-green-500" size={16} />;
      case 'connecting':
        return <RefreshCw className="text-yellow-500 animate-spin" size={16} />;
      default:
        return <AlertCircle className="text-red-500" size={16} />;
    }
  };

  const getConnectionIcon = (type) => {
    return connectionTypes[type]?.icon || <Server size={16} />;
  };

  const getConnectionColor = (type) => {
    const colors = {
      'opc-ua': 'border-blue-200 bg-blue-50',
      'rest': 'border-green-200 bg-green-50',
      'websocket': 'border-yellow-200 bg-yellow-50',
      'grpc': 'border-purple-200 bg-purple-50',
      'cpd': 'border-teal-200 bg-teal-50',
      'sql': 'border-indigo-200 bg-indigo-50'
    };
    return colors[type] || 'border-gray-200 bg-gray-50';
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Protocol Test Client</h1>
          <button
            onClick={() => setShowConnectionDialog(true)}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={16} className="mr-2" />
            Neue Connection
          </button>
        </div>

        {/* Connections List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Gespeicherte Connections</h3>
          {connections.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Database size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Keine Connections vorhanden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow ${getConnectionColor(connection.type)}`}
                  onClick={() => openConnection(connection)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getConnectionIcon(connection.type)}
                      <div>
                        <div className="font-medium text-sm">{connection.name}</div>
                        <div className="text-xs text-gray-500">{connectionTypes[connection.type]?.name}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConnection(connection.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    {connection.type === 'opc-ua' && connection.config.endpoint}
                    {connection.type === 'rest' && connection.config.baseUrl}
                    {connection.type === 'websocket' && connection.config.url}
                    {connection.type === 'grpc' && connection.config.address}
                    {connection.type === 'cpd' && (connection.config.protocol === 'grpc' ? connection.config.address : connection.config.url)}
                    {connection.type === 'sql' && `${connection.config.type}: ${connection.config.host}/${connection.config.database}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="border-t border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Clock size={16} className="mr-2" />
            Logs
          </h3>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="text-xs">
                <span className="text-gray-500">{log.timestamp}</span>
                <span className={`ml-2 ${
                  log.type === 'success' ? 'text-green-600' :
                  log.type === 'error' ? 'text-red-600' : 'text-gray-700'
                }`}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        {openTabs.length > 0 && (
          <div className="bg-white border-b border-gray-200 px-4">
            <div className="flex space-x-1 overflow-x-auto">
              {openTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center space-x-2 px-4 py-3 border-b-2 cursor-pointer ${
                    activeTab === tab.id 
                      ? 'border-blue-500 text-blue-600 bg-blue-50' 
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {getConnectionIcon(tab.type)}
                  <span className="font-medium">{tab.name}</span>
                  {getStatusIcon(tab.status)}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="ml-2 p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 p-6">
          {activeTab ? (
            <ConnectionWorkspace 
              connection={openTabs.find(tab => tab.id === activeTab)}
              onConnect={connectToService}
              onDisconnect={disconnectFromService}
              isLoading={isLoading}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Database size={64} className="mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-medium mb-2">Willkommen beim Protocol Test Client</h2>
                <p>Wählen Sie eine Connection aus der Sidebar oder erstellen Sie eine neue.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Dialog */}
      {showConnectionDialog && (
        <ConnectionDialog 
          onClose={() => setShowConnectionDialog(false)}
          onSave={saveConnection}
          connectionTypes={connectionTypes}
        />
      )}
    </div>
  );
};

// Connection Workspace Component
const ConnectionWorkspace = ({ connection, onConnect, onDisconnect, isLoading }) => {
  if (!connection) return null;

  const isConnected = connection.status === 'connected';

  return (
    <div className="h-full flex flex-col">
      {/* Connection Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {connectionTypes[connection.type]?.icon}
            <div>
              <h2 className="text-xl font-bold">{connection.name}</h2>
              <p className="text-gray-600">{connectionTypes[connection.type]?.name}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            {isConnected ? (
              <button
                onClick={() => onDisconnect(connection.id)}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                <WifiOff size={16} className="mr-2" />
                Trennen
              </button>
            ) : (
              <button
                onClick={() => onConnect(connection.id)}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Wifi size={16} className="mr-2" />}
                Verbinden
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Status:</span>
            <span className={`ml-2 ${
              isConnected ? 'text-green-600' : 'text-red-600'
            }`}>
              {isConnected ? 'Verbunden' : 'Getrennt'}
            </span>
          </div>
          <div>
            <span className="font-medium">Typ:</span>
            <span className="ml-2">{connectionTypes[connection.type]?.name}</span>
          </div>
        </div>
      </div>

      {/* Protocol-specific Content */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 p-6">
        {connection.type === 'opc-ua' && <OpcUaWorkspace connection={connection} />}
        {connection.type === 'rest' && <RestWorkspace connection={connection} />}
        {connection.type === 'websocket' && <WebSocketWorkspace connection={connection} />}
        {connection.type === 'grpc' && <GrpcWorkspace connection={connection} />}
        {connection.type === 'cpd' && <CpdWorkspace connection={connection} />}
        {connection.type === 'sql' && <SqlWorkspace connection={connection} />}
      </div>
    </div>
  );
};

// Connection Dialog Component
const ConnectionDialog = ({ onClose, onSave, connectionTypes }) => {
  const [selectedType, setSelectedType] = useState('opc-ua');
  const [name, setName] = useState('');
  const [config, setConfig] = useState({});

  const handleSave = () => {
    if (!name.trim()) {
      alert('Bitte geben Sie einen Namen ein');
      return;
    }

    const connectionData = {
      name: name.trim(),
      type: selectedType,
      config,
      createdAt: new Date().toISOString()
    };

    onSave(connectionData);
    onClose();
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderField = (field) => {
    // Check condition if field has one
    if (field.condition) {
      const conditionValue = config[field.condition.field];
      if (conditionValue !== field.condition.value) {
        return null; // Don't render this field
      }
    }

    switch (field.type) {
      case 'select':
        return (
          <select
            value={config[field.name] || field.default || ''}
            onChange={(e) => handleConfigChange(field.name, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {field.options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea
            value={config[field.name] || ''}
            onChange={(e) => handleConfigChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={config[field.name] || field.default || false}
            onChange={(e) => handleConfigChange(field.name, e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        );
      default:
        return (
          <input
            type={field.type}
            value={config[field.name] || ''}
            onChange={(e) => handleConfigChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Neue Connection</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Connection Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meine Connection"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Connection Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection Typ *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(connectionTypes).map(([key, type]) => (
                <label
                  key={key}
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedType === key 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="connectionType"
                    value={key}
                    checked={selectedType === key}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="sr-only"
                  />
                  {type.icon}
                  <span className="font-medium">{type.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Connection Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Konfiguration
            </label>
            <div className="space-y-4">
              {connectionTypes[selectedType]?.fields.map((field) => {
                // Check condition if field has one
                if (field.condition) {
                  const conditionValue = config[field.condition.field];
                  if (conditionValue !== field.condition.value) {
                    return null; // Don't render this field
                  }
                }

                return (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label} {field.required && '*'}
                    </label>
                    {renderField(field)}
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Save size={16} className="mr-2 inline" />
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
};

// Import workspace components (these would be separate files in a real app)
// For this demo, we'll include basic implementations

// OPC UA Workspace - simplified version
const OpcUaWorkspace = ({ connection }) => {
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeValue, setNodeValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const browseNodes = async () => {
    if (!connection || connection.status !== 'connected') return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/unicon/api/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'browse',
          params: { nodeId: 'RootFolder' }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setNodes(result.nodes || []);
      }
    } catch (error) {
      console.error('Browse error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (connection?.status === 'connected') {
      browseNodes();
    }
  }, [connection?.status]);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">OPC UA Browser</h3>
        <button
          onClick={browseNodes}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
          Refresh
        </button>
      </div>
      
      <div className="flex-1 grid grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">Nodes</h4>
          {nodes.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {nodes.map((node) => (
                <div
                  key={node.nodeId}
                  onClick={() => {
                    setSelectedNode(node);
                    setNodeValue(node.value || '');
                  }}
                  className={`p-2 rounded cursor-pointer hover:bg-gray-50 ${
                    selectedNode?.nodeId === node.nodeId ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  <div className="font-medium text-sm">{node.displayName}</div>
                  <div className="text-xs text-gray-500">{node.nodeId}</div>
                  {node.value && (
                    <div className="text-xs text-gray-600 mt-1">Value: {node.value}</div>
                  )}
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
        
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">Node Operations</h4>
          {selectedNode ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Node ID</label>
                <input
                  type="text"
                  value={selectedNode.nodeId}
                  readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <input
                  type="text"
                  value={nodeValue}
                  onChange={(e) => setNodeValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
                  Read
                </button>
                <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                  Write
                </button>
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
};

// REST API Workspace - simplified version  
const RestWorkspace = ({ connection }) => {
  const [method, setMethod] = useState('GET');
  const [endpoint, setEndpoint] = useState('/');
  const [response, setResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendRequest = async () => {
    if (!connection || connection.status !== 'connected') return;
    
    setIsLoading(true);
    try {
      const result = await fetch('/unicon/api/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'request',
          params: { method, endpoint, data: null, headers: {} }
        })
      });
      
      const data = await result.json();
      setResponse(data.success ? data.data : { error: data.error });
    } catch (error) {
      setResponse({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <h3 className="text-lg font-medium">REST API Client</h3>
      
      <div className="flex space-x-3">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="/api/endpoint"
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={sendRequest}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={16} className="animate-spin" /> : 'Send'}
        </button>
      </div>
      
      {response && (
        <div className="flex-1 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">Response</h4>
          <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

// WebSocket Workspace - simplified version
const WebSocketWorkspace = ({ connection }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const sendMessage = async () => {
    if (!message.trim() || !connection || connection.status !== 'connected') return;
    
    try {
      await fetch('/unicon/api/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'send',
          params: { message }
        })
      });
      
      setMessages(prev => [...prev, { type: 'sent', content: message, timestamp: new Date() }]);
      setMessage('');
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <h3 className="text-lg font-medium">WebSocket Client</h3>
      
      <div className="flex-1 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium mb-3">Messages</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {messages.map((msg, index) => (
            <div key={index} className={`p-2 rounded ${
              msg.type === 'sent' ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-green-50 border-l-4 border-green-500'
            }`}>
              <div className="text-xs text-gray-500 mb-1">{msg.timestamp.toLocaleTimeString()}</div>
              <div className="font-mono text-sm">{msg.content}</div>
            </div>
          ))}
        </div>
        
        <div className="flex space-x-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// CPD Workspace - advanced implementation
const CpdWorkspace = ({ connection }) => {
  const [activeTab, setActiveTab] = useState('topics');
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [subscriptions, setSubscriptions] = useState([]);
  const [publishData, setPublishData] = useState('{}');
  const [topicPattern, setTopicPattern] = useState('sw.sensor.#');
  const [messages, setMessages] = useState([]);
  const [browsePattern, setBrowsePattern] = useState('sw.*');
  const [isLoading, setIsLoading] = useState(false);
  const [pingMessage, setPingMessage] = useState('test');

  const API_BASE = '/unicon/api';

  const sendPing = async () => {
    if (!connection || connection.status !== 'connected') return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'ping',
          params: { message: pingMessage }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setMessages(prev => [...prev, {
          type: 'ping',
          data: result.data,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Ping error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const browseTopics = async () => {
    if (!connection || connection.status !== 'connected') return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'browseTopics',
          params: { 
            topicPattern: browsePattern,
            limit: 100,
            beginTopicName: '',
            reverse: false
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setTopics(result.topicNames || []);
      }
    } catch (error) {
      console.error('Browse error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribe = async () => {
    if (!connection || connection.status !== 'connected' || !topicPattern) return;
    
    const subscriptionId = Date.now();
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'simpleSubscribe',
          params: {
            id: subscriptionId,
            topicPatterns: topicPattern.split('\n').map(t => t.trim()).filter(t => t)
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setSubscriptions(prev => [...prev, {
          id: subscriptionId,
          patterns: topicPattern.split('\n'),
          timestamp: new Date()
        }]);
        setMessages(prev => [...prev, {
          type: 'subscribe',
          data: `Subscribed to: ${topicPattern}`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Subscribe error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async (subscriptionId) => {
    if (!connection || connection.status !== 'connected') return;
    
    try {
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'unsubscribe',
          params: { id: subscriptionId }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setSubscriptions(prev => prev.filter(sub => sub.id !== subscriptionId));
        setMessages(prev => [...prev, {
          type: 'unsubscribe',
          data: `Unsubscribed from ID: ${subscriptionId}`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  };

  const publish = async () => {
    if (!connection || connection.status !== 'connected' || !selectedTopic) return;
    
    setIsLoading(true);
    try {
      let data;
      try {
        data = JSON.parse(publishData);
      } catch {
        data = publishData; // Use as string if not valid JSON
      }
      
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'publish',
          params: {
            topic: selectedTopic,
            data: data,
            mode: 'publish'
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setMessages(prev => [...prev, {
          type: 'publish',
          data: `Published to ${selectedTopic}: ${publishData}`,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Publish error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLatestData = async () => {
    if (!connection || connection.status !== 'connected') return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'getLatestData',
          params: {
            topicPatterns: topicPattern.split('\n').map(t => t.trim()).filter(t => t)
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setMessages(prev => [...prev, {
          type: 'latestData',
          data: result.data,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Get latest data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle incoming messages from WebSocket
  useEffect(() => {
    const handleWebSocketMessage = (message) => {
      if (message.data.payload?.type === 'topicChange') {
        const topicChange = message.data.payload;
        topicChange.topics.forEach(topicData => {
          setMessages(prev => [...prev, {
            type: 'received',
            topic: topicData.topic,
            data: topicData.data,
            subscriptionId: topicChange.subscriptionId,
            timestamp: new Date()
          }].slice(-100)); // Keep last 100 messages
        });
      }
    };
    
    // This would be connected to actual WebSocket events
    return () => {};
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex space-x-8">
          {['topics', 'messages', 'subscriptions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'topics' && 'Topics & Browse'}
              {tab === 'messages' && `Messages (${messages.length})`}
              {tab === 'subscriptions' && `Subscriptions (${subscriptions.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Topics Tab */}
      {activeTab === 'topics' && (
        <div className="flex-1 space-y-6">
          {/* Ping Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Connection Test</h4>
            <div className="flex space-x-3">
              <input
                type="text"
                value={pingMessage}
                onChange={(e) => setPingMessage(e.target.value)}
                placeholder="Ping message"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                onClick={sendPing}
                disabled={isLoading}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
              >
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : 'Ping'}
              </button>
            </div>
          </div>

          {/* Browse Topics */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Browse Topics</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={browsePattern}
                  onChange={(e) => setBrowsePattern(e.target.value)}
                  placeholder="sw.*"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <button
                  onClick={browseTopics}
                  disabled={isLoading}
                  className="w-full px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin inline" /> : <Search size={16} className="mr-2 inline" />}
                  Browse
                </button>
              </div>
              
              {topics.length > 0 && (
                <div className="mt-4 max-h-64 overflow-y-auto border border-gray-200 rounded">
                  {topics.map((topic, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedTopic(topic)}
                      className={`p-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
                        selectedTopic === topic ? 'bg-teal-50 border-teal-200' : ''
                      }`}
                    >
                      <span className="font-mono text-sm">{topic}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Publish */}
            <div>
              <h4 className="font-medium mb-3">Publish Data</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  placeholder="sw.sensor.temperature"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <textarea
                  value={publishData}
                  onChange={(e) => setPublishData(e.target.value)}
                  placeholder='{"value": 23.5, "unit": "°C"}'
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <button
                  onClick={publish}
                  disabled={isLoading || !selectedTopic}
                  className="w-full px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                >
                  {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin inline" /> : <Send size={16} className="mr-2 inline" />}
                  Publish
                </button>
              </div>
            </div>
          </div>

          {/* Subscribe Section */}
          <div>
            <h4 className="font-medium mb-3">Topic Subscription</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic Patterns</label>
                <textarea
                  value={topicPattern}
                  onChange={(e) => setTopicPattern(e.target.value)}
                  placeholder="sw.sensor.#&#10;sw.assets.*"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div className="flex flex-col justify-end space-y-2">
                <button
                  onClick={subscribe}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Subscribe
                </button>
                <button
                  onClick={getLatestData}
                  disabled={isLoading}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Get Latest Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="flex-1">
          <div className="h-full border border-gray-200 rounded-lg overflow-hidden">
            <div className="h-full overflow-y-auto p-4 space-y-3">
              {messages.length > 0 ? (
                messages.map((msg, index) => (
                  <div key={index} className={`p-3 rounded-lg border-l-4 ${
                    msg.type === 'received' ? 'border-green-500 bg-green-50' :
                    msg.type === 'publish' ? 'border-blue-500 bg-blue-50' :
                    msg.type === 'ping' ? 'border-yellow-500 bg-yellow-50' :
                    'border-gray-300 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 uppercase">{msg.type}</span>
                      <span className="text-xs text-gray-500">{msg.timestamp.toLocaleTimeString()}</span>
                    </div>
                    {msg.topic && (
                      <div className="text-sm font-mono text-gray-700 mb-1">Topic: {msg.topic}</div>
                    )}
                    <div className="text-sm font-mono bg-white rounded p-2 border">
                      <pre className="whitespace-pre-wrap break-words">
                        {typeof msg.data === 'object' ? JSON.stringify(msg.data, null, 2) : msg.data}
                      </pre>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Code size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Keine Nachrichten</p>
                    <p className="text-sm">CPD-Nachrichten werden hier angezeigt</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-3">
          {subscriptions.length > 0 ? (
            subscriptions.map((sub) => (
              <div key={sub.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium">Subscription ID: {sub.id}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({sub.timestamp.toLocaleTimeString()})
                    </span>
                  </div>
                  <button
                    onClick={() => unsubscribe(sub.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    Unsubscribe
                  </button>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Patterns:</span>
                  <div className="font-mono text-gray-600 mt-1">
                    {sub.patterns.map((pattern, idx) => (
                      <div key={idx}>{pattern}</div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Activity size={48} className="mx-auto mb-4 opacity-50" />
                <p>Keine aktiven Subscriptions</p>
                <p className="text-sm">Abonnieren Sie Topics, um Live-Updates zu erhalten</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// SQL Workspace - simplified version
const SqlWorkspace = ({ connection }) => {
  const [query, setQuery] = useState('SELECT 1 as test;');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const executeQuery = async () => {
    if (!connection || connection.status !== 'connected') return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/unicon/api/operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'query',
          params: { sql: query, params: [] }
        })
      });
      
      const data = await response.json();
      setResult(data.success ? data.data : { error: data.error });
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <h3 className="text-lg font-medium">SQL Database Client</h3>
      
      <div className="space-y-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter SQL query..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={executeQuery}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin inline" /> : <Play size={16} className="mr-2 inline" />}
          Execute
        </button>
      </div>
      
      {result && (
        <div className="flex-1 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium mb-3">Result</h4>
          <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default UniversalTestClient;