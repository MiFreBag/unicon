import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Trash2, 
  Copy,
  RefreshCw,
  Code,
  Activity,
  Search,
  Play,
  Pause,
  Settings,
  MessageSquare,
  Database,
  Clock,
  AlertCircle,
  CheckCircle2,
  Zap,
  Globe
} from 'lucide-react';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import ConnectionBadge from '../ui/ConnectionBadge.jsx';
import ConnectionLog from '../components/ConnectionLog.jsx';

import { createConnection } from '../lib/api';

const CpdWorkspace = ({ connection, openTab }) => {
  const [activeTab, setActiveTab] = useState('topics');
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [subscriptions, setSubscriptions] = useState([]);
  const [publishData, setPublishData] = useState('{"value": 23.5, "unit": "°C", "timestamp": "' + new Date().toISOString() + '"}');
  const [topicPattern, setTopicPattern] = useState('sw.sensor.#\nsw.assets.#');
  const [messages, setMessages] = useState([]);
  const [browsePattern, setBrowsePattern] = useState('sw.*');
  const [isLoading, setIsLoading] = useState(false);
  const [pingMessage, setPingMessage] = useState('test');
  const [publishMode, setPublishMode] = useState('publish');
  const [subscriptionConfig, setSubscriptionConfig] = useState({
    storeAll: false,
    flatSubscribe: true,
    sendInitialData: true,
    aggrMode: 0
  });

  const API_BASE = '/unicon/api';

  // Publish modes available in CPD
  const publishModes = [
    { value: 'publish', label: 'Publish (Full→Full)', description: 'Standard publish' },
    { value: 'publishUpdate', label: 'Publish Update', description: 'Merge partial data' },
    { value: 'deltaPublish', label: 'Delta Publish', description: 'Changes only' },
    { value: 'publishDeltaToDelta', label: 'Delta→Delta', description: 'Performance optimized' },
    { value: 'publishDeltaToFull', label: 'Delta→Full', description: 'Merge delta to full' },
    { value: 'publishFullToDelta', label: 'Full→Delta', description: 'Extract changes' },
    { value: 'sendTopic', label: 'Send Topic', description: 'No storage/management' }
  ];

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
        addMessage('ping', `Ping response: ${result.data?.msg || 'OK'}`, null, result.data);
      } else {
        addMessage('error', `Ping failed: ${result.error}`, null, null);
      }
    } catch (error) {
      console.error('Ping error:', error);
      addMessage('error', `Ping error: ${error.message}`, null, null);
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
        addMessage('browse', `Found ${result.topicNames?.length || 0} topics`, null, result.topicNames);
      } else {
        addMessage('error', `Browse failed: ${result.error}`, null, null);
      }
    } catch (error) {
      console.error('Browse error:', error);
      addMessage('error', `Browse error: ${error.message}`, null, null);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribe = async () => {
    if (!connection || connection.status !== 'connected' || !topicPattern.trim()) return;
    
    const subscriptionId = Date.now();
    setIsLoading(true);
    
    try {
      const patterns = topicPattern.split('\n').map(t => t.trim()).filter(t => t);
      
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'subscribe',
          params: {
            id: subscriptionId,
            topicPatterns: patterns,
            config: subscriptionConfig
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setSubscriptions(prev => [...prev, {
          id: subscriptionId,
          patterns: patterns,
          config: subscriptionConfig,
          timestamp: new Date(),
          messageCount: 0
        }]);
        addMessage('subscribe', `Subscribed to ${patterns.length} patterns`, null, { id: subscriptionId, patterns });
      } else {
        addMessage('error', `Subscribe failed: ${result.error}`, null, null);
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      addMessage('error', `Subscribe error: ${error.message}`, null, null);
    } finally {
      setIsLoading(false);
    }
  };

  const simpleSubscribe = async () => {
    if (!connection || connection.status !== 'connected' || !topicPattern.trim()) return;
    
    const subscriptionId = Date.now();
    setIsLoading(true);
    
    try {
      const patterns = topicPattern.split('\n').map(t => t.trim()).filter(t => t);
      
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'simpleSubscribe',
          params: {
            id: subscriptionId,
            topicPatterns: patterns
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setSubscriptions(prev => [...prev, {
          id: subscriptionId,
          patterns: patterns,
          config: { simple: true },
          timestamp: new Date(),
          messageCount: 0
        }]);
        addMessage('subscribe', `Simple subscribed to ${patterns.length} patterns`, null, { id: subscriptionId, patterns });
      } else {
        addMessage('error', `Simple subscribe failed: ${result.error}`, null, null);
      }
    } catch (error) {
      console.error('Simple subscribe error:', error);
      addMessage('error', `Simple subscribe error: ${error.message}`, null, null);
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
        addMessage('unsubscribe', `Unsubscribed from ID: ${subscriptionId}`, null, { id: subscriptionId });
      } else {
        addMessage('error', `Unsubscribe failed: ${result.error}`, null, null);
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      addMessage('error', `Unsubscribe error: ${error.message}`, null, null);
    }
  };

  const publish = async () => {
    if (!connection || connection.status !== 'connected' || !selectedTopic.trim()) return;
    
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
          operation: publishMode,
          params: {
            topic: selectedTopic,
            data: data
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        addMessage('publish', `Published (${publishMode}) to: ${selectedTopic}`, selectedTopic, data);
      } else {
        addMessage('error', `Publish failed: ${result.error}`, selectedTopic, null);
      }
    } catch (error) {
      console.error('Publish error:', error);
      addMessage('error', `Publish error: ${error.message}`, selectedTopic, null);
    } finally {
      setIsLoading(false);
    }
  };

  const getLatestData = async () => {
    if (!connection || connection.status !== 'connected') return;
    
    setIsLoading(true);
    try {
      const patterns = topicPattern.split('\n').map(t => t.trim()).filter(t => t);
      
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'getLatestData',
          params: {
            topicPatterns: patterns
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        addMessage('latestData', `Retrieved latest data for ${patterns.length} patterns`, null, result.data);
      } else {
        addMessage('error', `Get latest data failed: ${result.error}`, null, null);
      }
    } catch (error) {
      console.error('Get latest data error:', error);
      addMessage('error', `Get latest data error: ${error.message}`, null, null);
    } finally {
      setIsLoading(false);
    }
  };

  const addMessage = (type, message, topic = null, data = null) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      type,
      message,
      topic,
      data,
      timestamp: new Date()
    };
    
    setMessages(prev => [newMessage, ...prev.slice(0, 99)]); // Keep last 100 messages
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      addMessage('info', 'Copied to clipboard', null, null);
    });
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const formatJsonData = (data) => {
    if (typeof data === 'string') {
      try {
        return JSON.stringify(JSON.parse(data), null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  };

  const getMessageIcon = (type) => {
    switch (type) {
      case 'ping': return <Zap className="text-yellow-500" size={14} />;
      case 'subscribe': return <Activity className="text-green-500" size={14} />;
      case 'unsubscribe': return <Pause className="text-orange-500" size={14} />;
      case 'publish': return <Send className="text-blue-500" size={14} />;
      case 'received': return <MessageSquare className="text-purple-500" size={14} />;
      case 'browse': return <Search className="text-teal-500" size={14} />;
      case 'latestData': return <Database className="text-indigo-500" size={14} />;
      case 'error': return <AlertCircle className="text-red-500" size={14} />;
      case 'info': return <CheckCircle2 className="text-gray-500" size={14} />;
      default: return <MessageSquare className="text-gray-500" size={14} />;
    }
  };

  const getMessageStyle = (type) => {
    switch (type) {
      case 'ping': return 'border-l-yellow-500 bg-yellow-50';
      case 'subscribe': return 'border-l-green-500 bg-green-50';
      case 'unsubscribe': return 'border-l-orange-500 bg-orange-50';
      case 'publish': return 'border-l-blue-500 bg-blue-50';
      case 'received': return 'border-l-purple-500 bg-purple-50';
      case 'browse': return 'border-l-teal-500 bg-teal-50';
      case 'latestData': return 'border-l-indigo-500 bg-indigo-50';
      case 'error': return 'border-l-red-500 bg-red-50';
      case 'info': return 'border-l-gray-300 bg-gray-50';
      default: return 'border-l-gray-300 bg-gray-50';
    }
  };

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = React.useCallback((message) => {
    if (message.data?.payload?.type === 'topicChange') {
      const topicChange = message.data.payload;
      // Update subscription message count
      setSubscriptions(prev => prev.map(sub =>
        sub.id === topicChange.subscriptionId
          ? { ...sub, messageCount: sub.messageCount + 1 }
          : sub
      ));
      // Add received messages
      topicChange.topics?.forEach(topicData => {
        addMessage('received', 'Topic data received', topicData.topic, topicData.data);
      });
    }
  }, [addMessage]);

  useEffect(() => {
    const onWs = (e) => handleWebSocketMessage(e.detail || {});
    window.addEventListener('unicon-ws', onWs);
    return () => window.removeEventListener('unicon-ws', onWs);
  }, [handleWebSocketMessage]);

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {['topics', 'messages', 'subscriptions', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'topics' && 'Topics & Operations'}
              {tab === 'messages' && `Messages (${messages.length})`}
              {tab === 'subscriptions' && `Subscriptions (${subscriptions.length})`}
              {tab === 'settings' && 'Settings'}
            </button>
          ))}
        </nav>
      </div>

      <ConnectionLog connectionId={connection?.id} />

      {/* Quick pick */}
      <div className="mb-3 text-sm text-gray-700 flex items-center gap-2">
        <span>Quick pick:</span>
        <select className="border rounded px-2 py-1" onChange={async (e)=>{
          const val = e.target.value; if (!val) return;
          const [protocol, target] = val.split('|');
          const payload = protocol==='grpc'
            ? { name: 'CPD gRPC (local)', type: 'cpd', config: { protocol:'grpc', address: target } }
            : { name: 'CPD WS (local)', type: 'cpd', config: { protocol:'websocket', url: target } };
          const res = await createConnection(payload);
          const conn = res.connection;
          if (typeof openTab === 'function') openTab('cpd', { connectionId: conn.id, connection: conn, title: `CPD • ${payload.name}` });
          e.target.value='';
        }}>
          <option value="">Pick…</option>
          <option value="grpc|localhost:8082">Local gRPC adapter (localhost:8082)</option>
          <option value="ws|ws://localhost:8003">Local WebSocket adapter (ws://localhost:8003)</option>
        </select>
      </div>

      {/* Topics Tab */}
      {activeTab === 'topics' && (
        <div className="flex-1 space-y-6">
          {/* Connection Test */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3 flex items-center">
              <Zap size={16} className="mr-2 text-yellow-500" />
              Connection Test
            </h4>
            <div className="flex space-x-3">
              <input
                type="text"
                value={pingMessage}
                onChange={(e) => setPingMessage(e.target.value)}
                placeholder="Ping message"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <Button onClick={sendPing} disabled={isLoading} leftIcon={Zap}>
                {isLoading ? <RefreshCw size={16} className="animate-spin" /> : null}
                Ping
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Browse Topics */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center">
                <Search size={16} className="mr-2 text-teal-500" />
                Browse Topics
              </h4>
              
              <div className="space-y-3">
                <input
                  type="text"
                  value={browsePattern}
                  onChange={(e) => setBrowsePattern(e.target.value)}
                  placeholder="sw.* or sw.sensors.# or specific.topic.name"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <Button variant="secondary" className="w-full" onClick={browseTopics} disabled={isLoading} leftIcon={Search}>
                  {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin" /> : null}
                  Browse Topics
                </Button>
              </div>
              
              {topics.length > 0 && (
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  <div className="p-2 bg-gray-50 border-b text-xs font-medium text-gray-600">
                    Found {topics.length} topics
                  </div>
                  {topics.map((topic, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedTopic(topic)}
                      className={`p-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                        selectedTopic === topic ? 'bg-teal-50 border-teal-200' : ''
                      }`}
                    >
                      <span className="font-mono text-sm">{topic}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Publish Data */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center">
                <Send size={16} className="mr-2 text-blue-500" />
                Publish Data
              </h4>
              
              <div className="space-y-3">
                <input
                  type="text"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  placeholder="sw.sensor.temperature.room1"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                
                <select
                  value={publishMode}
                  onChange={(e) => setPublishMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {publishModes.map(mode => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label} - {mode.description}
                    </option>
                  ))}
                </select>
                
                <textarea
                  value={publishData}
                  onChange={(e) => setPublishData(e.target.value)}
                  placeholder='{"value": 23.5, "unit": "°C", "timestamp": "2024-01-01T12:00:00Z"}'
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                
                <Button className="w-full" onClick={publish} disabled={isLoading || !selectedTopic.trim()} leftIcon={Send}>
                  {`Publish (${publishMode})`}
                </Button>
              </div>
            </div>
          </div>

          {/* Subscription Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-4 flex items-center">
              <Activity size={16} className="mr-2 text-green-500" />
              Topic Subscriptions
            </h4>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Topic Patterns</label>
                <textarea
                  value={topicPattern}
                  onChange={(e) => setTopicPattern(e.target.value)}
                  placeholder="sw.sensor.#&#10;sw.assets.*&#10;specific.topic.name"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Use # for multi-level wildcard, * for single-level wildcard. One pattern per line.
                </div>
              </div>
              
              <div className="flex flex-col justify-end space-y-2">
                <Button onClick={simpleSubscribe} disabled={isLoading || !topicPattern.trim()} leftIcon={Activity}>
                  Simple Subscribe
                </Button>
                <Button onClick={subscribe} disabled={isLoading || !topicPattern.trim()} leftIcon={Activity}>
                  Advanced Subscribe
                </Button>
                <Button variant="secondary" onClick={getLatestData} disabled={isLoading || !topicPattern.trim()} leftIcon={Database}>
                  Get Latest Data
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === 'messages' && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Message History</h3>
            <div className="flex space-x-2">
              <button
                onClick={clearMessages}
                disabled={messages.length === 0}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <Trash2 size={14} className="mr-1" />
                Clear
              </button>
            </div>
          </div>
          
          <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
            <div className="h-full overflow-y-auto p-4 space-y-3">
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <div key={msg.id} className={`p-3 rounded-lg border-l-4 ${getMessageStyle(msg.type)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getMessageIcon(msg.type)}
                        <span className="text-xs font-medium text-gray-600 uppercase">{msg.type}</span>
                        <span className="text-xs text-gray-500">{msg.timestamp.toLocaleTimeString()}</span>
                      </div>
                      {msg.data && (
                        <button
                          onClick={() => copyToClipboard(formatJsonData(msg.data))}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-700 mb-2">{msg.message}</div>
                    
                    {msg.topic && (
                      <div className="text-xs text-gray-600 mb-2">
                        <span className="font-medium">Topic:</span> <span className="font-mono">{msg.topic}</span>
                      </div>
                    )}
                    
                    {msg.data && (
                      <div className="text-xs bg-white rounded p-2 border font-mono">
                        <pre className="whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                          {formatJsonData(msg.data)}
                        </pre>
                      </div>
                    )}
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
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Active Subscriptions</h3>
          
          {subscriptions.length > 0 ? (
            subscriptions.map((sub) => (
              <div key={sub.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <div>
                      <span className="font-medium">Subscription ID: {sub.id}</span>
                      <div className="text-sm text-gray-500">
                        Created: {sub.timestamp.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-sm text-gray-600">
                      Messages: <span className="font-mono font-medium">{sub.messageCount}</span>
                    </div>
                    <button
                      onClick={() => unsubscribe(sub.id)}
                      className="inline-flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50"
                    >
                      <Pause size={14} className="mr-1" />
                      Unsubscribe
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Topic Patterns:</span>
                    <div className="mt-1 space-y-1">
                      {sub.patterns.map((pattern, idx) => (
                        <div key={idx} className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {pattern}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-gray-700">Configuration:</span>
                    <div className="mt-1 text-sm text-gray-600">
                      {sub.config.simple ? (
                        <div className="bg-blue-100 px-2 py-1 rounded">Simple Subscription</div>
                      ) : (
                        <div className="space-y-1">
                          <div>Store All: {sub.config.storeAll ? 'Yes' : 'No'}</div>
                          <div>Flat Subscribe: {sub.config.flatSubscribe ? 'Yes' : 'No'}</div>
                          <div>Send Initial: {sub.config.sendInitialData ? 'Yes' : 'No'}</div>
                          <div>Aggregation Mode: {sub.config.aggrMode}</div>
                        </div>
                      )}
                    </div>
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

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium">CPD Configuration</h3>
          
          {/* Connection Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Connection Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Protocol:</span>
                <span className="ml-2">{connection?.config?.protocol || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Address:</span>
                <span className="ml-2 font-mono">
                  {connection?.config?.protocol === 'grpc' 
                    ? connection?.config?.address 
                    : connection?.config?.url}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">TLS/Security:</span>
                <span className="ml-2">{connection?.config?.useTls ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className={`ml-2 font-medium ${
                  connection?.status === 'connected' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {connection?.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Subscription Configuration */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Default Subscription Configuration</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Store All Data</label>
                  <div className="text-xs text-gray-500">Force storage of all topic data within CPD adapter</div>
                </div>
                <button
                  onClick={() => setSubscriptionConfig(prev => ({ ...prev, storeAll: !prev.storeAll }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    subscriptionConfig.storeAll ? 'bg-teal-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    subscriptionConfig.storeAll ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Flat Subscribe</label>
                  <div className="text-xs text-gray-500">Only subscribe to currently available topics</div>
                </div>
                <button
                  onClick={() => setSubscriptionConfig(prev => ({ ...prev, flatSubscribe: !prev.flatSubscribe }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    subscriptionConfig.flatSubscribe ? 'bg-teal-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    subscriptionConfig.flatSubscribe ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Send Initial Data</label>
                  <div className="text-xs text-gray-500">Send latest data immediately upon subscription</div>
                </div>
                <button
                  onClick={() => setSubscriptionConfig(prev => ({ ...prev, sendInitialData: !prev.sendInitialData }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    subscriptionConfig.sendInitialData ? 'bg-teal-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    subscriptionConfig.sendInitialData ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Aggregation Mode</label>
                <select
                  value={subscriptionConfig.aggrMode}
                  onChange={(e) => setSubscriptionConfig(prev => ({ ...prev, aggrMode: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value={0}>ON_ANY - Individual topic updates</option>
                  <option value={1}>ON_CAPTURETIME - Group updates by time window</option>
                  <option value={2}>ON_CAPTURETRIGGER - Group updates by trigger topic</option>
                </select>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3">Session Statistics</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-teal-600">{subscriptions.length}</div>
                <div className="text-sm text-gray-600">Active Subscriptions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{messages.length}</div>
                <div className="text-sm text-gray-600">Total Messages</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {subscriptions.reduce((sum, sub) => sum + sub.messageCount, 0)}
                </div>
                <div className="text-sm text-gray-600">Received Updates</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CpdWorkspace;