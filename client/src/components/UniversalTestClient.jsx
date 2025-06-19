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
import { connectionTypes } from '../constants/connectionTypes.jsx';

// UniversalTestClient.jsx - Key-Duplikate beheben

const UniversalTestClient = () => {
  // ... andere State-Variablen ...
  const [logs, setLogs] = useState([]);

  // Logs mit eindeutigen IDs hinzufügen
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Eindeutige ID
      message,
      type,
      timestamp
    };
    
    setLogs(prevLogs => {
      // Verhindere Duplikate basierend auf Nachricht und Zeitstempel
      const isDuplicate = prevLogs.some(log => 
        log.message === message && 
        log.timestamp === timestamp
      );
      
      if (isDuplicate) {
        return prevLogs;
      }
      
      return [logEntry, ...prevLogs.slice(0, 99)]; // Behalte nur 100 Logs
    });
  };

  // WebSocket Message Handler
  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'connection_status':
        updateConnectionStatus(data.data.connectionId, data.data.status);
        break;
      case 'log':
        addLog(data.data.message, data.data.type);
        break;
      case 'data':
        updateConnectionData(data.data);
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  // Log-Rendering mit eindeutigen Keys
  const renderLogs = () => {
    return (
      <div className="bg-gray-900 text-white p-4 h-64 overflow-y-auto font-mono text-sm">
        <div className="mb-2 text-green-400">
          === Universal Protocol Test Client Logs ===
        </div>
        {logs.map((log) => (
          <div 
            key={log.id} // Verwende die eindeutige ID als Key
            className={`mb-1 ${
              log.type === 'error' ? 'text-red-400' :
              log.type === 'success' ? 'text-green-400' :
              log.type === 'warning' ? 'text-yellow-400' :
              'text-gray-300'
            }`}
          >
            <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
          </div>
        ))}
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

};

export default UniversalTestClient;