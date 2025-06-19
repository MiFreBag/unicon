import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Trash2, 
  Download,
  Copy,
  RefreshCw,
  Zap,
  MessageSquare,
  Clock,
  ArrowUp,
  ArrowDown,
  Settings,
  Pause,
  Play,
  Volume2,
  VolumeX
} from 'lucide-react';

const WebSocketWorkspace = ({ connection }) => {
  const [activeTab, setActiveTab] = useState('console');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [messageFilter, setMessageFilter] = useState('');
  const [isJsonMode, setIsJsonMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStats, setConnectionStats] = useState({
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransferred: 0,
    connectedSince: null
  });
  const [savedMessages, setSavedMessages] = useState([
    { name: 'Ping', content: '{"type": "ping", "timestamp": "' + new Date().toISOString() + '"}' },
    { name: 'Hello', content: '{"type": "hello", "message": "Hello Server!"}' },
    { name: 'Subscribe', content: '{"type": "subscribe", "channel": "updates"}' }
  ]);

  const messagesEndRef = useRef(null);
  const API_BASE = '/unicon/api';

  useEffect(() => {
    if (isAutoScroll) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    if (connection?.status === 'connected' && !connectionStats.connectedSince) {
      setConnectionStats(prev => ({
        ...prev,
        connectedSince: new Date()
      }));
    }
  }, [connection?.status]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    if (!message.trim() || connection?.status !== 'connected' || isLoading) return;

    setIsLoading(true);

    try {
      let messageToSend = message;
      
      // Validate JSON if in JSON mode
      if (isJsonMode) {
        try {
          JSON.parse(message);
        } catch (error) {
          throw new Error('Invalid JSON format');
        }
      }

      const requestData = {
        connectionId: connection.id,
        operation: 'send',
        params: {
          message: messageToSend
        }
      };

      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      
      if (result.success) {
        // Add sent message to console
        const sentMessage = {
          id: Date.now(),
          type: 'sent',
          content: messageToSend,
          timestamp: new Date(),
          size: new Blob([messageToSend]).size
        };
        
        setMessages(prev => [...prev, sentMessage]);
        setConnectionStats(prev => ({
          ...prev,
          messagesSent: prev.messagesSent + 1,
          bytesTransferred: prev.bytesTransferred + sentMessage.size
        }));
        
        setMessage('');
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Send error:', error);
      const errorMessage = {
        id: Date.now(),
        type: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
        size: 0
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSavedMessage = (savedMessage) => {
    setMessage(savedMessage.content);
  };

  const saveFavorite = () => {
    if (!message.trim()) return;
    
    const name = prompt('Name for this message:');
    if (name) {
      setSavedMessages(prev => [...prev, {
        name,
        content: message
      }]);
    }
  };

  const deleteSavedMessage = (index) => {
    setSavedMessages(prev => prev.filter((_, i) => i !== index));
  };

  const clearMessages = () => {
    setMessages([]);
    setConnectionStats(prev => ({
      ...prev,
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0
    }));
  };

  const exportMessages = () => {
    const exportData = {
      connection: connection.name,
      timestamp: new Date().toISOString(),
      messages: messages.map(msg => ({
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `websocket-${connection.name}-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyMessage = (content) => {
    navigator.clipboard.writeText(content);
  };

  const formatJson = (text) => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'sent': return <ArrowUp className="text-blue-500" size={14} />;
      case 'received': return <ArrowDown className="text-green-500" size={14} />;
      case 'error': return <MessageSquare className="text-red-500" size={14} />;
      default: return <MessageSquare className="text-gray-500" size={14} />;
    }
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case 'sent': return 'border-l-blue-500 bg-blue-50';
      case 'received': return 'border-l-green-500 bg-green-50';
      case 'error': return 'border-l-red-500 bg-red-50';
      default: return 'border-l-gray-300 bg-gray-50';
    }
  };

  const filteredMessages = messages.filter(msg => 
    !messageFilter || msg.content.toLowerCase().includes(messageFilter.toLowerCase())
  );

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Simulate receiving messages (this would come from WebSocket in real implementation)
  useEffect(() => {
    const handleWebSocketMessage = (message) => {
      const receivedMessage = {
        id: Date.now(),
        type: 'received',
        content: message.data.payload?.data || 'Unknown message',
        timestamp: new Date(),
        size: new Blob([message.data.payload?.data || '']).size
      };
      
      setMessages(prev => [...prev, receivedMessage]);
      setConnectionStats(prev => ({
        ...prev,
        messagesReceived: prev.messagesReceived + 1,
        bytesTransferred: prev.bytesTransferred + receivedMessage.size
      }));
    };

    // This would be connected to actual WebSocket events
    // For now it's just a placeholder
    return () => {};
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {['console', 'composer', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'console' && 'Console'}
              {tab === 'composer' && 'Message Composer'}
              {tab === 'settings' && 'Settings'}
            </button>
          ))}
        </nav>
      </div>

      {/* Console Tab */}
      {activeTab === 'console' && (
        <div className="flex-1 flex flex-col">
          {/* Stats Bar */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{connectionStats.messagesSent}</div>
                <div className="text-gray-600">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{connectionStats.messagesReceived}</div>
                <div className="text-gray-600">Received</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{formatBytes(connectionStats.bytesTransferred)}</div>
                <div className="text-gray-600">Data</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {connectionStats.connectedSince ? 
                    Math.floor((new Date() - connectionStats.connectedSince) / 1000) + 's' : 
                    '0s'
                  }
                </div>
                <div className="text-gray-600">Uptime</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={messageFilter}
                onChange={(e) => setMessageFilter(e.target.value)}
                placeholder="Filter messages..."
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
              />
              <button
                onClick={() => setIsAutoScroll(!isAutoScroll)}
                className={`inline-flex items-center px-3 py-1 rounded text-sm ${
                  isAutoScroll ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {isAutoScroll ? <Volume2 size={14} className="mr-1" /> : <VolumeX size={14} className="mr-1" />}
                Auto-scroll
              </button>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={exportMessages}
                disabled={messages.length === 0}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={14} className="mr-1" />
                Export
              </button>
              <button
                onClick={clearMessages}
                disabled={messages.length === 0}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Trash2 size={14} className="mr-1" />
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="h-full overflow-y-auto p-4 space-y-3">
              {filteredMessages.length > 0 ? (
                filteredMessages.map((msg) => (
                  <div key={msg.id} className={`border-l-4 p-3 rounded ${getMessageStyle(msg.type)}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getMessageIcon(msg.type)}
                        <span className="text-xs font-medium text-gray-600 uppercase">
                          {msg.type}
                        </span>
                        <span className="text-xs text-gray-500">
                          {msg.timestamp.toLocaleTimeString()}
                        </span>
                        {msg.size > 0 && (
                          <span className="text-xs text-gray-500">
                            ({formatBytes(msg.size)})
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => copyMessage(msg.content)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="font-mono text-sm bg-white rounded p-2 border">
                      <pre className="whitespace-pre-wrap break-words">
                        {isJsonMode ? formatJson(msg.content) : msg.content}
                      </pre>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Zap size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Keine Nachrichten</p>
                    <p className="text-sm">Nachrichten werden hier angezeigt</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Send Message */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsJsonMode(!isJsonMode)}
                className={`px-3 py-1 rounded text-sm ${
                  isJsonMode ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                JSON
              </button>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isJsonMode ? '{"type": "message", "data": "Hello"}' : 'Your message...'}
                rows={3}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim() || connection?.status !== 'connected' || isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                Send
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Tip: Use Ctrl+Enter to send quickly
            </div>
          </div>
        </div>
      )}

      {/* Message Composer Tab */}
      {activeTab === 'composer' && (
        <div className="flex-1 space-y-6">
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Saved Messages</h4>
            <div className="space-y-3">
              {savedMessages.map((savedMsg, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">{savedMsg.name}</h5>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => loadSavedMessage(savedMsg)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteSavedMessage(index)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2 font-mono text-sm">
                    <pre className="whitespace-pre-wrap break-words">
                      {formatJson(savedMsg.content)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6">
              <button
                onClick={saveFavorite}
                disabled={!message.trim()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <Plus size={16} className="mr-2" />
                Save Current Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="flex-1 space-y-6">
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Connection Settings</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">URL:</span>
                  <span className="ml-2 font-mono">{connection?.config?.url}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Protocol:</span>
                  <span className="ml-2 font-mono">{connection?.config?.protocol || 'Default'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className={`ml-2 font-medium ${
                    connection?.status === 'connected' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {connection?.status === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Heartbeat:</span>
                  <span className="ml-2 font-mono">
                    {connection?.config?.heartbeat ? `${connection.config.heartbeat}ms` : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Display Settings</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">JSON Formatting</span>
                <button
                  onClick={() => setIsJsonMode(!isJsonMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isJsonMode ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isJsonMode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Auto-scroll Messages</span>
                <button
                  onClick={() => setIsAutoScroll(!isAutoScroll)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isAutoScroll ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAutoScroll ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebSocketWorkspace;