import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Upload, 
  Download,
  Copy,
  RefreshCw,
  MessageSquare,
  FileText,
  Settings,
  Clock,
  Zap,
  Code,
  Play,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Server,
  Layers
} from 'lucide-react';

const GrpcWorkspace = ({ connection }) => {
  const [activeTab, setActiveTab] = useState('client');
  const [selectedService, setSelectedService] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [requestData, setRequestData] = useState('{}');
  const [response, setResponse] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [protoContent, setProtoContent] = useState('');
  const [services, setServices] = useState([]);
  const [metadata, setMetadata] = useState([{ key: '', value: '' }]);
  const [callStats, setCallStats] = useState({
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    totalLatency: 0
  });

  const API_BASE = '/unicon/api';

  // Sample proto structure (would be parsed from actual .proto file)
  useEffect(() => {
    if (connection?.status === 'connected') {
      loadProtoDefinition();
    }
  }, [connection?.status]);

  const loadProtoDefinition = () => {
    // Sample gRPC service definition
    const sampleServices = [
      {
        name: 'UserService',
        methods: [
          {
            name: 'GetUser',
            type: 'unary',
            requestType: 'GetUserRequest',
            responseType: 'User',
            description: 'Get user by ID',
            sampleRequest: {
              id: 1
            }
          },
          {
            name: 'CreateUser',
            type: 'unary',
            requestType: 'CreateUserRequest',
            responseType: 'User',
            description: 'Create a new user',
            sampleRequest: {
              name: 'John Doe',
              email: 'john@example.com',
              age: 30
            }
          },
          {
            name: 'StreamUsers',
            type: 'server_streaming',
            requestType: 'StreamUsersRequest',
            responseType: 'User',
            description: 'Stream all users',
            sampleRequest: {
              limit: 10
            }
          },
          {
            name: 'UpdateUsers',
            type: 'client_streaming',
            requestType: 'User',
            responseType: 'UpdateUsersResponse',
            description: 'Update multiple users',
            sampleRequest: {
              id: 1,
              name: 'Updated Name'
            }
          }
        ]
      },
      {
        name: 'OrderService',
        methods: [
          {
            name: 'GetOrder',
            type: 'unary',
            requestType: 'GetOrderRequest',
            responseType: 'Order',
            description: 'Get order by ID',
            sampleRequest: {
              orderId: 'order-123'
            }
          },
          {
            name: 'PlaceOrder',
            type: 'unary',
            requestType: 'PlaceOrderRequest',
            responseType: 'Order',
            description: 'Place a new order',
            sampleRequest: {
              userId: 1,
              items: [
                { productId: 'prod-1', quantity: 2 },
                { productId: 'prod-2', quantity: 1 }
              ],
              shippingAddress: {
                street: '123 Main St',
                city: 'Anytown',
                country: 'US'
              }
            }
          }
        ]
      }
    ];

    setServices(sampleServices);
    if (sampleServices.length > 0) {
      setSelectedService(sampleServices[0]);
      setSelectedMethod(sampleServices[0].methods[0]);
      setRequestData(JSON.stringify(sampleServices[0].methods[0].sampleRequest, null, 2));
    }

    // Sample proto content
    const sampleProto = `syntax = "proto3";

package user;

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc StreamUsers(StreamUsersRequest) returns (stream User);
  rpc UpdateUsers(stream User) returns (UpdateUsersResponse);
}

message GetUserRequest {
  int32 id = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
  int32 age = 3;
}

message User {
  int32 id = 1;
  string name = 2;
  string email = 3;
  int32 age = 4;
  string created_at = 5;
}

message StreamUsersRequest {
  int32 limit = 1;
}

message UpdateUsersResponse {
  int32 updated_count = 1;
}`;

    setProtoContent(sampleProto);
  };

  const executeCall = async () => {
    if (!selectedMethod || connection?.status !== 'connected' || isLoading) return;

    setIsLoading(true);
    const startTime = Date.now();

    try {
      // Validate JSON request
      let parsedRequest;
      try {
        parsedRequest = JSON.parse(requestData);
      } catch (error) {
        throw new Error('Invalid JSON in request body');
      }

      // Build metadata
      const grpcMetadata = {};
      metadata.forEach(meta => {
        if (meta.key && meta.value) {
          grpcMetadata[meta.key] = meta.value;
        }
      });

      const requestPayload = {
        connectionId: connection.id,
        operation: 'call',
        params: {
          service: selectedService.name,
          method: selectedMethod.name,
          request: parsedRequest,
          metadata: grpcMetadata
        }
      };

      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      const result = await response.json();
      const latency = Date.now() - startTime;
      
      if (result.success) {
        const callResult = {
          id: Date.now(),
          service: selectedService.name,
          method: selectedMethod.name,
          request: parsedRequest,
          response: result.data,
          metadata: grpcMetadata,
          latency,
          timestamp: new Date(),
          status: 'success'
        };
        
        setResponse(callResult);
        setCallHistory(prev => [callResult, ...prev.slice(0, 49)]);
        
        setCallStats(prev => ({
          totalCalls: prev.totalCalls + 1,
          successfulCalls: prev.successfulCalls + 1,
          failedCalls: prev.failedCalls,
          totalLatency: prev.totalLatency + latency
        }));
      } else {
        throw new Error(result.error || 'gRPC call failed');
      }
    } catch (error) {
      console.error('gRPC call error:', error);
      const errorResult = {
        id: Date.now(),
        service: selectedService.name,
        method: selectedMethod.name,
        request: JSON.parse(requestData),
        error: error.message,
        latency: Date.now() - startTime,
        timestamp: new Date(),
        status: 'error'
      };
      
      setResponse(errorResult);
      setCallHistory(prev => [errorResult, ...prev.slice(0, 49)]);
      
      setCallStats(prev => ({
        totalCalls: prev.totalCalls + 1,
        successfulCalls: prev.successfulCalls,
        failedCalls: prev.failedCalls + 1,
        totalLatency: prev.totalLatency + (Date.now() - startTime)
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const selectMethod = (service, method) => {
    setSelectedService(service);
    setSelectedMethod(method);
    setRequestData(JSON.stringify(method.sampleRequest, null, 2));
  };

  const addMetadata = () => {
    setMetadata(prev => [...prev, { key: '', value: '' }]);
  };

  const updateMetadata = (index, field, value) => {
    setMetadata(prev => prev.map((meta, i) => 
      i === index ? { ...meta, [field]: value } : meta
    ));
  };

  const removeMetadata = (index) => {
    setMetadata(prev => prev.filter((_, i) => i !== index));
  };

  const loadFromHistory = (historyItem) => {
    const service = services.find(s => s.name === historyItem.service);
    const method = service?.methods.find(m => m.name === historyItem.method);
    
    if (service && method) {
      setSelectedService(service);
      setSelectedMethod(method);
      setRequestData(JSON.stringify(historyItem.request, null, 2));
      
      // Load metadata
      const metadataEntries = Object.entries(historyItem.metadata || {});
      setMetadata(metadataEntries.length > 0 ? 
        metadataEntries.map(([key, value]) => ({ key, value })) : 
        [{ key: '', value: '' }]
      );
    }
  };

  const formatJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getMethodIcon = (type) => {
    switch (type) {
      case 'unary': return <Zap className="text-blue-500" size={14} />;
      case 'server_streaming': return <Download className="text-green-500" size={14} />;
      case 'client_streaming': return <Upload className="text-orange-500" size={14} />;
      case 'bidirectional_streaming': return <RefreshCw className="text-purple-500" size={14} />;
      default: return <MessageSquare className="text-gray-500" size={14} />;
    }
  };

  const getMethodTypeLabel = (type) => {
    switch (type) {
      case 'unary': return 'Unary';
      case 'server_streaming': return 'Server Streaming';
      case 'client_streaming': return 'Client Streaming';
      case 'bidirectional_streaming': return 'Bidirectional Streaming';
      default: return 'Unknown';
    }
  };

  const formatLatency = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="h-full flex">
      {/* Services Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Layers size={16} className="mr-2" />
            gRPC Services
          </h3>
          
          {services.length > 0 ? (
            <div className="space-y-2">
              {services.map((service) => (
                <div key={service.name} className="border border-gray-200 rounded-lg bg-white">
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center space-x-2">
                      <Server size={14} className="text-blue-500" />
                      <span className="font-medium text-sm">{service.name}</span>
                    </div>
                  </div>
                  
                  <div className="p-2 space-y-1">
                    {service.methods.map((method) => (
                      <button
                        key={method.name}
                        onClick={() => selectMethod(service, method)}
                        className={`w-full text-left p-2 rounded text-sm hover:bg-gray-50 ${
                          selectedMethod?.name === method.name && selectedService?.name === service.name
                            ? 'bg-blue-50 border border-blue-200'
                            : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            {getMethodIcon(method.type)}
                            <span className="font-medium">{method.name}</span>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {getMethodTypeLabel(method.type)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {method.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Server size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Services werden geladen...</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 p-4">
          <nav className="flex space-x-8">
            {['client', 'response', 'history', 'proto'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'client' && 'Client'}
                {tab === 'response' && 'Response'}
                {tab === 'history' && `History (${callHistory.length})`}
                {tab === 'proto' && 'Proto Definition'}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 p-6">
          {/* Client Tab */}
          {activeTab === 'client' && (
            <div className="h-full flex flex-col space-y-6">
              {/* Stats Bar */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{callStats.totalCalls}</div>
                    <div className="text-gray-600">Total Calls</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{callStats.successfulCalls}</div>
                    <div className="text-gray-600">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-600">{callStats.failedCalls}</div>
                    <div className="text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-600">
                      {callStats.totalCalls > 0 ? 
                        formatLatency(Math.round(callStats.totalLatency / callStats.totalCalls)) : 
                        '0ms'
                      }
                    </div>
                    <div className="text-gray-600">Avg Latency</div>
                  </div>
                </div>
              </div>

              {/* Method Info */}
              {selectedMethod && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getMethodIcon(selectedMethod.type)}
                      <div>
                        <h4 className="font-medium">{selectedService?.name}.{selectedMethod.name}</h4>
                        <p className="text-sm text-gray-600">{selectedMethod.description}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {getMethodTypeLabel(selectedMethod.type)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Request Type:</span>
                      <span className="ml-2 font-mono">{selectedMethod.requestType}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Response Type:</span>
                      <span className="ml-2 font-mono">{selectedMethod.responseType}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Metadata</h4>
                  <button
                    onClick={addMetadata}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Plus size={14} className="mr-1" />
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {metadata.map((meta, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={meta.key}
                        onChange={(e) => updateMetadata(index, 'key', e.target.value)}
                        placeholder="Key"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={meta.value}
                        onChange={(e) => updateMetadata(index, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removeMetadata(index)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Body */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Request Body</h4>
                  <button
                    onClick={() => copyToClipboard(requestData)}
                    className="inline-flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                  >
                    <Copy size={12} className="mr-1" />
                    Copy
                  </button>
                </div>
                <textarea
                  value={requestData}
                  onChange={(e) => setRequestData(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Execute Button */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {connection?.config?.address}
                </div>
                <button
                  onClick={executeCall}
                  disabled={!selectedMethod || connection?.status !== 'connected' || isLoading}
                  className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                  Call Method
                </button>
              </div>
            </div>
          )}

          {/* Response Tab */}
          {activeTab === 'response' && (
            <div className="h-full flex flex-col">
              {response ? (
                <div className="space-y-6">
                  {/* Response Header */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Call Result</h4>
                      <button
                        onClick={() => copyToClipboard(formatJson(response.response || response.error))}
                        className="inline-flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                      >
                        <Copy size={12} className="mr-1" />
                        Copy
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 inline-flex items-center ${
                          response.status === 'success' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {response.status === 'success' ? 
                            <CheckCircle2 size={14} className="mr-1" /> : 
                            <AlertCircle size={14} className="mr-1" />
                          }
                          {response.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Method:</span>
                        <span className="ml-2 font-mono">{response.service}.{response.method}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Latency:</span>
                        <span className="ml-2 font-mono">{formatLatency(response.latency)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span>
                        <span className="ml-2 font-mono">{response.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Request */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Request</h5>
                    <div className="bg-gray-900 text-blue-400 rounded-lg p-3 font-mono text-sm">
                      <pre>{formatJson(response.request)}</pre>
                    </div>
                  </div>

                  {/* Response or Error */}
                  {response.status === 'success' ? (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Response</h5>
                      <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-sm">
                        <pre>{formatJson(response.response)}</pre>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h5 className="text-sm font-medium text-red-700 mb-2">Error</h5>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <pre className="text-red-800 text-sm">{response.error}</pre>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  {Object.keys(response.metadata || {}).length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Metadata</h5>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="space-y-1 text-sm font-mono">
                          {Object.entries(response.metadata).map(([key, value]) => (
                            <div key={key} className="flex">
                              <span className="text-gray-600 w-32 flex-shrink-0">{key}:</span>
                              <span className="text-gray-800">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Keine Response verfügbar</p>
                    <p className="text-sm">Führen Sie einen gRPC Call aus</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {callHistory.length > 0 ? (
                callHistory.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                       onClick={() => loadFromHistory(item)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        {item.status === 'success' ? 
                          <CheckCircle2 className="text-green-500" size={16} /> : 
                          <AlertCircle className="text-red-500" size={16} />
                        }
                        <span className="font-mono text-sm">{item.service}.{item.method}</span>
                        <span className="text-xs text-gray-500">
                          {formatLatency(item.latency)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.timestamp.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded p-2 font-mono text-sm">
                      <pre className="whitespace-pre-wrap break-words">
                        {formatJson(item.request).slice(0, 200)}
                        {formatJson(item.request).length > 200 && '...'}
                      </pre>
                    </div>
                    {item.error && (
                      <div className="mt-2 text-red-600 text-sm">
                        Error: {item.error}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  <div className="text-center">
                    <Clock size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Keine Call History</p>
                    <p className="text-sm">Ihre gRPC Calls werden hier angezeigt</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proto Definition Tab */}
          {activeTab === 'proto' && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium text-gray-900">Protocol Buffer Definition</h4>
                <div className="flex space-x-2">
                  <button className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
                    <Upload size={14} className="mr-1" />
                    Upload .proto
                  </button>
                  <button
                    onClick={() => copyToClipboard(protoContent)}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Copy size={14} className="mr-1" />
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="flex-1">
                <textarea
                  value={protoContent}
                  onChange={(e) => setProtoContent(e.target.value)}
                  className="w-full h-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Paste your .proto file content here..."
                />
              </div>
              
              <div className="text-sm text-gray-500">
                Upload or paste your Protocol Buffer definition to automatically discover services and methods.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GrpcWorkspace;