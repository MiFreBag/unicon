// Enhanced REST Workspace with OpenAPI/Swagger Support
// client/src/workspaces/EnhancedRestWorkspace.jsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Plus, 
  Trash2, 
  Copy, 
  Download,
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  Globe,
  Code,
  Clock,
  AlertCircle,
  CheckCircle,
  Book,
  Tag,
  FileText,
  Link,
  Settings,
  Play,
  Zap,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';

const EnhancedRestWorkspace = ({ connection }) => {
  const [activeTab, setActiveTab] = useState('request');
  const [request, setRequest] = useState({
    method: 'GET',
    endpoint: '/',
    headers: {},
    body: '',
    params: {}
  });
  const [response, setResponse] = useState(null);
  const [requestHistory, setRequestHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customHeaders, setCustomHeaders] = useState([{ key: '', value: '' }]);
  const [queryParams, setQueryParams] = useState([{ key: '', value: '' }]);
  const [showRawResponse, setShowRawResponse] = useState(false);
  
  // OpenAPI/Swagger specific state
  const [openApiSpec, setOpenApiSpec] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [openApiFile, setOpenApiFile] = useState(null);
  const [openApiUrl, setOpenApiUrl] = useState('');
  const [showOpenApiDialog, setShowOpenApiDialog] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState('all');
  const [endpointSearch, setEndpointSearch] = useState('');
  const [showEndpointBrowser, setShowEndpointBrowser] = useState(false);
  const [validation, setValidation] = useState(null);

  const fileInputRef = useRef(null);
  const API_BASE = '/unicon/api';

  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

  // Load OpenAPI data when connection is established
  useEffect(() => {
    if (connection && connection.status === 'connected') {
      loadEndpoints();
    }
  }, [connection]);

  const loadEndpoints = async () => {
    try {
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'getEndpoints'
        })
      });

      const result = await response.json();
      if (result.success) {
        setEndpoints(result.data.endpoints || []);
        setAvailableTags(['all', ...result.data.tags || []]);
        setOpenApiSpec(result.data.info || null);
      }
    } catch (error) {
      console.error('Failed to load endpoints:', error);
    }
  };

  const handleOpenApiUpload = async () => {
    if (!openApiFile && !openApiUrl) {
      alert('Please select a file or enter a URL');
      return;
    }

    try {
      let uploadData = {
        connectionId: connection.id,
        operation: 'loadOpenApi'
      };

      if (openApiFile) {
        // Handle file upload
        const formData = new FormData();
        formData.append('openApiFile', openApiFile);
        formData.append('connectionId', connection.id);

        const uploadResponse = await fetch(`${API_BASE}/upload-openapi`, {
          method: 'POST',
          body: formData
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
          throw new Error(uploadResult.error);
        }

        uploadData.params = { openApiFile: uploadResult.filename };
      } else if (openApiUrl) {
        uploadData.params = { openApiUrl };
      }

      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadData)
      });

      const result = await response.json();
      if (result.success) {
        await loadEndpoints();
        setShowOpenApiDialog(false);
        setOpenApiFile(null);
        setOpenApiUrl('');
        alert(`OpenAPI specification loaded successfully! Found ${endpoints.length} endpoints.`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert(`Failed to load OpenAPI specification: ${error.message}`);
    }
  };

  const sendRequest = async () => {
    if (!connection || connection.status !== 'connected') {
      alert('Not connected to server');
      return;
    }

    // Validate request if OpenAPI spec is available
    if (selectedEndpoint) {
      const validationResult = await validateRequest();
      setValidation(validationResult);
      
      if (!validationResult.valid && validationResult.errors.length > 0) {
        const proceed = confirm(`Validation warnings:\n${validationResult.errors.join('\n')}\n\nProceed anyway?`);
        if (!proceed) return;
      }
    }

    setIsLoading(true);
    setResponse(null);

    try {
      // Build headers from custom headers array
      const headers = {};
      customHeaders.forEach(header => {
        if (header.key && header.value) {
          headers[header.key] = header.value;
        }
      });

      // Build query parameters
      const params = {};
      queryParams.forEach(param => {
        if (param.key && param.value) {
          params[param.key] = param.value;
        }
      });

      const requestData = {
        connectionId: connection.id,
        operation: 'request',
        params: {
          method: request.method,
          endpoint: request.endpoint,
          data: request.body ? JSON.parse(request.body) : null,
          headers,
          params
        }
      };

      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      
      if (result.success || result.data) {
        const responseData = result.data || result;
        responseData.timestamp = responseData.timestamp || new Date().toISOString();
        responseData.request = { ...request, headers, params };
        
        setResponse(responseData);
        
        // Add to history
        setRequestHistory(prev => [responseData, ...prev.slice(0, 49)]);
      } else {
        throw new Error(result.error || 'Request failed');
      }
    } catch (error) {
      console.error('Request error:', error);
      setResponse({
        status: 0,
        statusText: 'Error',
        data: { error: error.message },
        timestamp: new Date().toISOString(),
        request: { ...request }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateRequest = async () => {
    try {
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'validateRequest',
          params: {
            path: selectedEndpoint.path,
            method: request.method,
            headers: customHeaders.reduce((acc, h) => {
              if (h.key && h.value) acc[h.key] = h.value;
              return acc;
            }, {}),
            params: queryParams.reduce((acc, p) => {
              if (p.key && p.value) acc[p.key] = p.value;
              return acc;
            }, {}),
            body: request.body ? JSON.parse(request.body) : null
          }
        })
      });

      const result = await response.json();
      return result.success ? result.data : { valid: false, errors: [result.error] };
    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  };

  const selectEndpoint = async (endpoint) => {
    setSelectedEndpoint(endpoint);
    setRequest(prev => ({
      ...prev,
      method: endpoint.method,
      endpoint: endpoint.path
    }));

    // Generate example request
    try {
      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          operation: 'generateExample',
          params: {
            path: endpoint.path,
            method: endpoint.method
          }
        })
      });

      const result = await response.json();
      if (result.success) {
        const example = result.data;
        
        // Set headers
        const headerEntries = Object.entries(example.headers || {}).map(([key, value]) => ({ key, value }));
        if (headerEntries.length === 0) headerEntries.push({ key: '', value: '' });
        setCustomHeaders(headerEntries);

        // Set query params
        const paramEntries = Object.entries(example.queryParams || {}).map(([key, value]) => ({ key, value }));
        if (paramEntries.length === 0) paramEntries.push({ key: '', value: '' });
        setQueryParams(paramEntries);

        // Set body
        if (example.body) {
          setRequest(prev => ({
            ...prev,
            body: JSON.stringify(example.body, null, 2)
          }));
        }
      }
    } catch (error) {
      console.error('Failed to generate example:', error);
    }

    setShowEndpointBrowser(false);
  };

  const filteredEndpoints = endpoints.filter(endpoint => {
    const matchesTag = selectedTag === 'all' || endpoint.tags.includes(selectedTag);
    const matchesSearch = !endpointSearch || 
      endpoint.path.toLowerCase().includes(endpointSearch.toLowerCase()) ||
      endpoint.summary?.toLowerCase().includes(endpointSearch.toLowerCase()) ||
      endpoint.method.toLowerCase().includes(endpointSearch.toLowerCase());
    
    return matchesTag && matchesSearch;
  });

  const addCustomHeader = () => {
    setCustomHeaders(prev => [...prev, { key: '', value: '' }]);
  };

  const updateCustomHeader = (index, field, value) => {
    setCustomHeaders(prev => prev.map((header, i) => 
      i === index ? { ...header, [field]: value } : header
    ));
  };

  const removeCustomHeader = (index) => {
    setCustomHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const addQueryParam = () => {
    setQueryParams(prev => [...prev, { key: '', value: '' }]);
  };

  const updateQueryParam = (index, field, value) => {
    setQueryParams(prev => prev.map((param, i) => 
      i === index ? { ...param, [field]: value } : param
    ));
  };

  const removeQueryParam = (index) => {
    setQueryParams(prev => prev.filter((_, i) => i !== index));
  };

  const exportResponse = () => {
    if (!response) return;
    
    const exportData = {
      request: response.request,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      },
      timestamp: response.timestamp
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rest-response-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyResponse = () => {
    if (!response) return;
    navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
  };

  const tabs = [
    { id: 'request', label: 'Request' },
    { id: 'response', label: 'Response' },
    { id: 'history', label: `History (${requestHistory.length})` },
    { id: 'openapi', label: 'OpenAPI' }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Globe className="text-green-600" size={20} />
          <h3 className="text-lg font-semibold">Enhanced REST Client</h3>
          {openApiSpec && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              OpenAPI Enabled
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowEndpointBrowser(true)}
            disabled={endpoints.length === 0}
            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Book size={16} className="mr-1" />
            Browse Endpoints
          </button>
          <button
            onClick={() => setShowOpenApiDialog(true)}
            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Upload size={16} className="mr-1" />
            Load OpenAPI
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Request Tab */}
        {activeTab === 'request' && (
          <div className="h-full flex flex-col space-y-4 p-4">
            {/* Selected Endpoint Info */}
            {selectedEndpoint && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                        selectedEndpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                        selectedEndpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                        selectedEndpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                        selectedEndpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedEndpoint.method}
                      </span>
                      <code className="text-sm">{selectedEndpoint.path}</code>
                    </div>
                    {selectedEndpoint.summary && (
                      <p className="text-sm text-gray-600 mt-1">{selectedEndpoint.summary}</p>
                    )}
                    {selectedEndpoint.tags.length > 0 && (
                      <div className="flex items-center space-x-1 mt-2">
                        {selectedEndpoint.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedEndpoint(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            {/* Validation Results */}
            {validation && !validation.valid && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle size={16} className="text-yellow-600" />
                  <h4 className="font-medium text-yellow-800">Validation Warnings</h4>
                </div>
                <ul className="mt-2 text-sm text-yellow-700">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="flex items-center space-x-1">
                      <span>•</span>
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Request Line */}
            <div className="flex space-x-3">
              <select
                value={request.method}
                onChange={(e) => setRequest(prev => ({ ...prev, method: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
              >
                {httpMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              <input
                type="text"
                value={request.endpoint}
                onChange={(e) => setRequest(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder="/api/endpoint"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendRequest}
                disabled={isLoading || connection?.status !== 'connected'}
                className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <RefreshCw size={16} className="animate-spin mr-2" />
                ) : (
                  <Send size={16} className="mr-2" />
                )}
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>

            {/* Request Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Query Parameters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Query Parameters</h4>
                  <button
                    onClick={addQueryParam}
                    className="inline-flex items-center px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Plus size={14} className="mr-1" />
                    Add
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {queryParams.map((param, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Key"
                        value={param.key}
                        onChange={(e) => updateQueryParam(index, 'key', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={param.value}
                        onChange={(e) => updateQueryParam(index, 'value', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removeQueryParam(index)}
                        className="px-2 py-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Headers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Headers</h4>
                  <button
                    onClick={addCustomHeader}
                    className="inline-flex items-center px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Plus size={14} className="mr-1" />
                    Add
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {customHeaders.map((header, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Key"
                        value={header.key}
                        onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => removeCustomHeader(index)}
                        className="px-2 py-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Request Body */}
            {['POST', 'PUT', 'PATCH'].includes(request.method) && (
              <div className="flex-1 flex flex-col space-y-2">
                <h4 className="font-medium">Request Body</h4>
                <textarea
                  value={request.body}
                  onChange={(e) => setRequest(prev => ({ ...prev, body: e.target.value }))}
                  placeholder='{"key": "value"}'
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Response Tab */}
        {activeTab === 'response' && (
          <div className="h-full flex flex-col p-4">
            {response ? (
              <>
                {/* Response Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${
                        response.status >= 200 && response.status < 300 ? 'bg-green-100 text-green-800' :
                        response.status >= 300 && response.status < 400 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {response.status} {response.statusText}
                      </span>
                      {response.duration && (
                        <span className="text-sm text-gray-500">
                          {response.duration}ms
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowRawResponse(!showRawResponse)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      {showRawResponse ? <EyeOff size={16} className="mr-1" /> : <Eye size={16} className="mr-1" />}
                      {showRawResponse ? 'Formatted' : 'Raw'}
                    </button>
                    <button
                      onClick={copyResponse}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Copy size={16} className="mr-1" />
                      Copy
                    </button>
                    <button
                      onClick={exportResponse}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Download size={16} className="mr-1" />
                      Export
                    </button>
                  </div>
                </div>

                {/* Response Content */}
                <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
                  <pre className="h-full overflow-auto p-4 bg-gray-900 text-green-400 text-sm">
                    {showRawResponse 
                      ? JSON.stringify(response, null, 2)
                      : JSON.stringify(response.data, null, 2)
                    }
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Send size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Send a request to see the response</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Request History</h4>
              <button
                onClick={() => setRequestHistory([])}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear History
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2">
              {requestHistory.length > 0 ? (
                requestHistory.map((item, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setResponse(item);
                      setActiveTab('response');
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                          item.request.method === 'GET' ? 'bg-green-100 text-green-800' :
                          item.request.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                          item.request.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                          item.request.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.request.method}
                        </span>
                        <span className="text-sm font-mono">{item.request.endpoint}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status >= 200 && item.status < 300 ? 'bg-green-100 text-green-800' :
                          item.status >= 300 && item.status < 400 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        {item.duration && <span>{item.duration}ms</span>}
                        <Clock size={14} />
                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Clock size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No requests in history</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OpenAPI Tab */}
        {activeTab === 'openapi' && (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">OpenAPI Specification</h4>
              <button
                onClick={() => setShowOpenApiDialog(true)}
                className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <Upload size={16} className="mr-1" />
                Load Spec
              </button>
            </div>

            {openApiSpec ? (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium mb-2">{openApiSpec.title}</h5>
                  <p className="text-sm text-gray-600 mb-2">{openApiSpec.description}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Version: {openApiSpec.version}</span>
                    <span>Endpoints: {endpoints.length}</span>
                    <span>Tags: {availableTags.length - 1}</span>
                  </div>
                </div>

                <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
                  <pre className="h-64 overflow-auto p-4 bg-gray-900 text-green-400 text-sm">
                    {JSON.stringify(openApiSpec, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="mb-2">No OpenAPI specification loaded</p>
                  <button
                    onClick={() => setShowOpenApiDialog(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Upload size={16} className="mr-2" />
                    Load OpenAPI Spec
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* OpenAPI Upload Dialog */}
      {showOpenApiDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowOpenApiDialog(false)}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Load OpenAPI Specification</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From URL</label>
                    <input
                      type="url"
                      value={openApiUrl}
                      onChange={(e) => setOpenApiUrl(e.target.value)}
                      placeholder="https://api.example.com/openapi.json"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="text-center text-gray-500">
                    <span className="text-sm">or</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.yaml,.yml"
                      onChange={(e) => setOpenApiFile(e.target.files[0])}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {openApiFile ? openApiFile.name : 'Choose JSON/YAML file...'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleOpenApiUpload}
                  disabled={!openApiUrl && !openApiFile}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Load Specification
                </button>
                <button
                  onClick={() => setShowOpenApiDialog(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Endpoint Browser Dialog */}
      {showEndpointBrowser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowEndpointBrowser(false)}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">API Endpoints</h3>
                  <button
                    onClick={() => setShowEndpointBrowser(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                {/* Search and Filter */}
                <div className="flex space-x-3 mb-4">
                  <div className="flex-1 relative">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search endpoints..."
                      value={endpointSearch}
                      onChange={(e) => setEndpointSearch(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableTags.map(tag => (
                      <option key={tag} value={tag}>
                        {tag === 'all' ? 'All Tags' : tag}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Endpoint List */}
                <div className="max-h-96 overflow-y-auto">
                  {filteredEndpoints.length > 0 ? (
                    <div className="space-y-2">
                      {filteredEndpoints.map((endpoint, index) => (
                        <div
                          key={index}
                          onClick={() => selectEndpoint(endpoint)}
                          className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                                endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                                endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                                endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                                endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {endpoint.method}
                              </span>
                              <code className="text-sm">{endpoint.path}</code>
                            </div>
                            {endpoint.deprecated && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                                Deprecated
                              </span>
                            )}
                          </div>
                          {endpoint.summary && (
                            <p className="text-sm text-gray-600 mt-1">{endpoint.summary}</p>
                          )}
                          {endpoint.tags.length > 0 && (
                            <div className="flex items-center space-x-1 mt-2">
                              {endpoint.tags.map(tag => (
                                <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Search size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No endpoints found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedRestWorkspace;