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