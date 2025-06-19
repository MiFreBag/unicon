import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Save, 
  Trash2, 
  Download,
  Copy,
  RefreshCw,
  Database,
  Table,
  Clock,
  BarChart3,
  FileText,
  Settings,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const SqlWorkspace = ({ connection }) => {
  const [activeTab, setActiveTab] = useState('query');
  const [query, setQuery] = useState('SELECT 1 as test_column;');
  const [queryResult, setQueryResult] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savedQueries, setSavedQueries] = useState([
    { name: 'Show Tables', query: 'SHOW TABLES;' },
    { name: 'Current Time', query: 'SELECT NOW() as current_time;' },
    { name: 'Database Version', query: 'SELECT VERSION() as version;' }
  ]);
  const [dbSchema, setDbSchema] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [queryStats, setQueryStats] = useState({
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalExecutionTime: 0
  });

  const queryEditorRef = useRef(null);
  const API_BASE = '/unicon/api';

  // Sample data for schema (would come from actual DB)
  useEffect(() => {
    if (connection?.status === 'connected') {
      loadDatabaseSchema();
    }
  }, [connection?.status]);

  const loadDatabaseSchema = async () => {
    // This would typically fetch actual schema from the database
    // For now, we'll use sample data
    const sampleSchema = [
      {
        name: 'users',
        type: 'table',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
          { name: 'username', type: 'VARCHAR(50)', nullable: false },
          { name: 'email', type: 'VARCHAR(100)', nullable: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
          { name: 'updated_at', type: 'TIMESTAMP', nullable: true }
        ]
      },
      {
        name: 'orders',
        type: 'table',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
          { name: 'user_id', type: 'INTEGER', nullable: false, foreignKey: 'users.id' },
          { name: 'total', type: 'DECIMAL(10,2)', nullable: false },
          { name: 'status', type: 'VARCHAR(20)', nullable: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false }
        ]
      },
      {
        name: 'products',
        type: 'table',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
          { name: 'name', type: 'VARCHAR(100)', nullable: false },
          { name: 'price', type: 'DECIMAL(8,2)', nullable: false },
          { name: 'stock', type: 'INTEGER', nullable: false, default: 0 }
        ]
      }
    ];
    setDbSchema(sampleSchema);
  };

  const executeQuery = async () => {
    if (!query.trim() || connection?.status !== 'connected' || isLoading) return;

    setIsLoading(true);
    const startTime = Date.now();

    try {
      const requestData = {
        connectionId: connection.id,
        operation: 'query',
        params: {
          sql: query.trim(),
          params: []
        }
      };

      const response = await fetch(`${API_BASE}/operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      const executionTime = Date.now() - startTime;
      
      if (result.success) {
        const queryResultData = {
          id: Date.now(),
          query: query.trim(),
          data: result.data || [],
          fields: result.fields || [],
          rowCount: result.data?.length || 0,
          executionTime,
          timestamp: new Date(),
          status: 'success'
        };
        
        setQueryResult(queryResultData);
        setQueryHistory(prev => [queryResultData, ...prev.slice(0, 49)]); // Keep last 50
        
        setQueryStats(prev => ({
          totalQueries: prev.totalQueries + 1,
          successfulQueries: prev.successfulQueries + 1,
          failedQueries: prev.failedQueries,
          totalExecutionTime: prev.totalExecutionTime + executionTime
        }));
      } else {
        throw new Error(result.error || 'Query failed');
      }
    } catch (error) {
      console.error('Query error:', error);
      const errorResult = {
        id: Date.now(),
        query: query.trim(),
        error: error.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
        status: 'error'
      };
      
      setQueryResult(errorResult);
      setQueryHistory(prev => [errorResult, ...prev.slice(0, 49)]);
      
      setQueryStats(prev => ({
        totalQueries: prev.totalQueries + 1,
        successfulQueries: prev.successfulQueries,
        failedQueries: prev.failedQueries + 1,
        totalExecutionTime: prev.totalExecutionTime + (Date.now() - startTime)
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const saveQuery = () => {
    if (!query.trim()) return;
    
    const name = prompt('Name for this query:');
    if (name) {
      setSavedQueries(prev => [...prev, {
        name,
        query: query.trim()
      }]);
    }
  };

  const loadSavedQuery = (savedQuery) => {
    setQuery(savedQuery.query);
  };

  const deleteSavedQuery = (index) => {
    setSavedQueries(prev => prev.filter((_, i) => i !== index));
  };

  const loadFromHistory = (historyItem) => {
    setQuery(historyItem.query);
  };

  const toggleTableExpansion = (tableName) => {
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableName)) {
        newSet.delete(tableName);
      } else {
        newSet.add(tableName);
      }
      return newSet;
    });
  };

  const generateSelectQuery = (table) => {
    const limit = connection.config.type === 'SQLite' ? 'LIMIT 10' : 'LIMIT 10';
    setQuery(`SELECT * FROM ${table.name} ${limit};`);
  };

  const generateDescribeQuery = (table) => {
    let describeQuery;
    switch (connection.config.type) {
      case 'PostgreSQL':
        describeQuery = `\\d ${table.name}`;
        break;
      case 'MySQL':
        describeQuery = `DESCRIBE ${table.name};`;
        break;
      case 'SQLite':
        describeQuery = `PRAGMA table_info(${table.name});`;
        break;
      default:
        describeQuery = `SELECT * FROM information_schema.columns WHERE table_name = '${table.name}';`;
    }
    setQuery(describeQuery);
  };

  const exportResults = () => {
    if (!queryResult || !queryResult.data) return;
    
    const csv = [
      queryResult.fields.join(','),
      ...queryResult.data.map(row => 
        queryResult.fields.map(field => 
          JSON.stringify(row[field] || '')
        ).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-result-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
  };

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getColumnIcon = (column) => {
    if (column.primaryKey) return '🗝️';
    if (column.foreignKey) return '🔗';
    if (!column.nullable) return '❗';
    return '📝';
  };

  return (
    <div className="h-full flex">
      {/* Schema Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <Database size={16} className="mr-2" />
            Database Schema
          </h3>
          
          {dbSchema.length > 0 ? (
            <div className="space-y-2">
              {dbSchema.map((table) => (
                <div key={table.name} className="border border-gray-200 rounded-lg bg-white">
                  <div 
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleTableExpansion(table.name)}
                  >
                    <div className="flex items-center space-x-2">
                      <Table size={14} className="text-blue-500" />
                      <span className="font-medium text-sm">{table.name}</span>
                    </div>
                    {expandedTables.has(table.name) ? 
                      <ChevronDown size={14} /> : <ChevronRight size={14} />
                    }
                  </div>
                  
                  {expandedTables.has(table.name) && (
                    <div className="border-t border-gray-200">
                      <div className="p-2 space-y-1">
                        {table.columns.map((column) => (
                          <div key={column.name} className="flex items-center space-x-2 text-xs p-1 hover:bg-gray-50 rounded">
                            <span>{getColumnIcon(column)}</span>
                            <span className="font-mono font-medium">{column.name}</span>
                            <span className="text-gray-500">{column.type}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 p-2 space-y-1">
                        <button
                          onClick={() => generateSelectQuery(table)}
                          className="w-full text-left text-xs text-blue-600 hover:text-blue-800 py-1"
                        >
                          SELECT * FROM {table.name}
                        </button>
                        <button
                          onClick={() => generateDescribeQuery(table)}
                          className="w-full text-left text-xs text-blue-600 hover:text-blue-800 py-1"
                        >
                          Describe table
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <Database size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Schema wird geladen...</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 p-4">
          <nav className="flex space-x-8">
            {['query', 'results', 'history', 'saved'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'query' && 'Query Editor'}
                {tab === 'results' && 'Results'}
                {tab === 'history' && `History (${queryHistory.length})`}
                {tab === 'saved' && `Saved (${savedQueries.length})`}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 p-6">
          {/* Query Editor Tab */}
          {activeTab === 'query' && (
            <div className="h-full flex flex-col space-y-4">
              {/* Stats Bar */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{queryStats.totalQueries}</div>
                    <div className="text-gray-600">Total Queries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{queryStats.successfulQueries}</div>
                    <div className="text-gray-600">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-600">{queryStats.failedQueries}</div>
                    <div className="text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-600">
                      {queryStats.totalQueries > 0 ? 
                        formatTime(Math.round(queryStats.totalExecutionTime / queryStats.totalQueries)) : 
                        '0ms'
                      }
                    </div>
                    <div className="text-gray-600">Avg Time</div>
                  </div>
                </div>
              </div>

              {/* Query Controls */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={executeQuery}
                    disabled={!query.trim() || connection?.status !== 'connected' || isLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <RefreshCw size={16} className="mr-2 animate-spin" /> : <Play size={16} className="mr-2" />}
                    Execute (Ctrl+Enter)
                  </button>
                  <button
                    onClick={saveQuery}
                    disabled={!query.trim()}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Save size={16} className="mr-2" />
                    Save
                  </button>
                  <button
                    onClick={copyQuery}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Copy size={16} className="mr-2" />
                    Copy
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  {connection?.config?.type} Database
                </div>
              </div>

              {/* Query Editor */}
              <div className="flex-1">
                <textarea
                  ref={queryEditorRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your SQL query here..."
                  className="w-full h-full px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      executeQuery();
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="h-full flex flex-col">
              {queryResult ? (
                <div className="space-y-4">
                  {/* Result Header */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Query Result</h4>
                      <div className="flex space-x-2">
                        {queryResult.status === 'success' && (
                          <button
                            onClick={exportResults}
                            className="inline-flex items-center px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
                          >
                            <Download size={12} className="mr-1" />
                            Export CSV
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 inline-flex items-center ${
                          queryResult.status === 'success' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {queryResult.status === 'success' ? 
                            <CheckCircle2 size={14} className="mr-1" /> : 
                            <AlertCircle size={14} className="mr-1" />
                          }
                          {queryResult.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Rows:</span>
                        <span className="ml-2 font-mono">{queryResult.rowCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span>
                        <span className="ml-2 font-mono">{formatTime(queryResult.executionTime)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Executed:</span>
                        <span className="ml-2 font-mono">{queryResult.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Query */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Query</h5>
                    <div className="bg-gray-900 text-green-400 rounded-lg p-3 font-mono text-sm">
                      <pre>{queryResult.query}</pre>
                    </div>
                  </div>

                  {/* Results or Error */}
                  {queryResult.status === 'success' ? (
                    queryResult.data && queryResult.data.length > 0 ? (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Data</h5>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  {queryResult.fields.map((field) => (
                                    <th key={field} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      {field}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {queryResult.data.map((row, index) => (
                                  <tr key={index} className="hover:bg-gray-50">
                                    {queryResult.fields.map((field) => (
                                      <td key={field} className="px-4 py-2 text-sm text-gray-900 font-mono">
                                        {row[field] === null ? (
                                          <span className="text-gray-400 italic">NULL</span>
                                        ) : (
                                          String(row[field])
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Query executed successfully</p>
                        <p className="text-sm">No data returned</p>
                      </div>
                    )
                  ) : (
                    <div>
                      <h5 className="text-sm font-medium text-red-700 mb-2">Error</h5>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <pre className="text-red-800 text-sm">{queryResult.error}</pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <BarChart3 size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Keine Ergebnisse verfügbar</p>
                    <p className="text-sm">Führen Sie eine Query aus, um Ergebnisse zu sehen</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {queryHistory.length > 0 ? (
                queryHistory.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                       onClick={() => loadFromHistory(item)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        {item.status === 'success' ? 
                          <CheckCircle2 className="text-green-500" size={16} /> : 
                          <AlertCircle className="text-red-500" size={16} />
                        }
                        <span className="text-sm text-gray-600">
                          {item.timestamp.toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTime(item.executionTime)}
                        </span>
                        {item.status === 'success' && (
                          <span className="text-xs text-gray-500">
                            {item.rowCount} rows
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-100 rounded p-2 font-mono text-sm">
                      <pre className="whitespace-pre-wrap break-words">
                        {item.query.length > 200 ? item.query.slice(0, 200) + '...' : item.query}
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
                    <p>Keine Query History</p>
                    <p className="text-sm">Ihre ausgeführten Queries werden hier angezeigt</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Saved Queries Tab */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              {savedQueries.map((savedQuery, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900">{savedQuery.name}</h5>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => loadSavedQuery(savedQuery)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteSavedQuery(index)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded p-2 font-mono text-sm">
                    <pre className="whitespace-pre-wrap break-words">{savedQuery.query}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlWorkspace;