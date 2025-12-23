import React, { useMemo, useState } from 'react'
import { Database, Globe, Zap, Server, Clock, Activity, Search, CheckCircle2, Play, ListTree, History, RotateCcw, Trash2, MessageSquare } from 'lucide-react'
import UniversalTestClient from './UniversalTestClient'

const protocolOptions = [
  {
    id: 'opc-ua',
    name: 'OPC UA',
    icon: <Server className="w-5 h-5" />, 
    description: 'Browse nodes, monitored items and endpoints for industrial devices.'
  },
  {
    id: 'rest',
    name: 'REST',
    icon: <Globe className="w-5 h-5" />,
    description: 'Explore OpenAPI endpoints and try quick requests.'
  },
  {
    id: 'websocket',
    name: 'WebSocket',
    icon: <Zap className="w-5 h-5" />,
    description: 'Inspect available channels and push diagnostics.'
  },
  {
    id: 'grpc',
    name: 'gRPC',
    icon: <MessageSquare className="w-5 h-5" />,
    description: 'Explore services, methods and call schemas.'
  },
  {
    id: 'sql',
    name: 'SQL',
    icon: <Database className="w-5 h-5" />,
    description: 'Preview schemas, tables and result sets.'
  }
]

const mockBrowseTrees = {
  'opc-ua': [
    { id: 'Root', label: 'Root', children: ['Objects', 'Types', 'Views'] },
    { id: 'Objects', label: 'Objects', children: ['PLC1', 'Alarms'] },
    { id: 'PLC1', label: 'PLC1', children: ['Sensors/Temperature', 'Sensors/Pressure'] }
  ],
  rest: [
    { id: '/', label: '/', children: ['metrics', 'health', 'v1/orders', 'v1/assets'] }
  ],
  websocket: [
    { id: 'channels', label: 'Channels', children: ['telemetry', 'alerts', 'audit-log'] }
  ],
  grpc: [
    { id: 'services', label: 'Services', children: ['InventoryService', 'TelemetryService'] },
    { id: 'InventoryService', label: 'InventoryService', children: ['ListItems', 'UpdateStock'] }
  ],
  sql: [
    { id: 'public', label: 'public', children: ['devices', 'readings', 'events'] },
    { id: 'devices', label: 'devices', children: ['id', 'name', 'last_seen'] }
  ]
}

const seededMonitoredItems = [
  { client: 'Gateway-A', connector: 'OPC UA', source: 'PLC1/Temp', name: 'Temperature', value: '42.7 °C', state: 'Active' },
  { client: 'Gateway-A', connector: 'MQTT', source: 'telemetry/pressure', name: 'Pressure', value: '5.2 bar', state: 'Active' },
  { client: 'Gateway-B', connector: 'REST API', source: 'v1/assets/12', name: 'Asset 12', value: 'online', state: 'Idle' },
  { client: 'Gateway-C', connector: 'SQL', source: 'inventory.items', name: 'Item count', value: '1,024', state: 'Active' }
]

const initialLog = [
  { id: 1, message: 'Bootstrapped monitoring workspace', ts: new Date() },
  { id: 2, message: 'Loaded example connections and recent access entries', ts: new Date() }
]

const ConnectionExperience = () => {
  const [wizardStep, setWizardStep] = useState(1)
  const [dataSource, setDataSource] = useState({ name: '', type: 'OPC UA', host: '', notes: '' })
  const [quickConnect, setQuickConnect] = useState({ url: '', label: '' })
  const [quickError, setQuickError] = useState('')
  const [quickHistory, setQuickHistory] = useState([])
  const [selectedProtocol, setSelectedProtocol] = useState('opc-ua')
  const [logs, setLogs] = useState(initialLog)
  const [monitoredItems, setMonitoredItems] = useState(seededMonitoredItems)
  const [filter, setFilter] = useState('')

  const endpointPlaceholders = {
    'OPC UA': 'opc.tcp://hostname:4840',
    REST: 'https://api.example.com',
    WebSocket: 'wss://example.com/socket',
    'gRPC': 'localhost:50051',
    SQL: 'postgres://user:pass@host:5432/db'
  }

  const filteredItems = useMemo(() => {
    const needle = filter.toLowerCase()
    return monitoredItems.filter(item =>
      [item.client, item.connector, item.source, item.name, item.value].some(value =>
        value.toLowerCase().includes(needle)
      )
    )
  }, [filter, monitoredItems])

  const stats = useMemo(() => {
    const activeCount = filteredItems.filter(item => item.state === 'Active').length
    const idleCount = filteredItems.filter(item => item.state !== 'Active').length

    return {
      total: filteredItems.length,
      activeCount,
      idleCount
    }
  }, [filteredItems])

  const goNextStep = () => setWizardStep(step => Math.min(3, step + 1))
  const goPrevStep = () => setWizardStep(step => Math.max(1, step - 1))

  const completeWizard = () => {
    setLogs(prev => [
      { id: Date.now(), message: `Created data source "${dataSource.name || 'New source'}" (${dataSource.type})`, ts: new Date() },
      ...prev
    ])
    setDataSource({ name: '', type: 'OPC UA', host: '', notes: '' })
    setWizardStep(1)
  }

  const logQuickConnect = (url, label) => {
    const timestamp = new Date()
    setLogs(prev => [
      { id: Date.now(), message: `Quick connect triggered for ${url}${label ? ` as ${label}` : ''}`, ts: timestamp },
      ...prev
    ])
  }

  const handleQuickConnect = (url = quickConnect.url, label = quickConnect.label) => {
    const trimmedUrl = url.trim()
    const trimmedLabel = label.trim()
    if (!trimmedUrl) {
      setQuickError('Enter a URL or connection string to start a probe.')
      return
    }

    setQuickError('')
    logQuickConnect(trimmedUrl, trimmedLabel)
    setQuickHistory(prev => [
      { id: Date.now(), url: trimmedUrl, label: trimmedLabel, ts: new Date() },
      ...prev
    ].slice(0, 5))
    setQuickConnect({ url: '', label: '' })
  }

  return (
    <div className="space-y-8">
      <section className="bg-white shadow border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">Onboarding</p>
            <h2 className="text-xl font-semibold">Data source wizard</h2>
          </div>
          <div className="flex space-x-2 text-sm text-gray-600">
            {[1, 2, 3].map(step => (
              <button
                key={step}
                className={`px-3 py-1 rounded-full border ${wizardStep === step ? 'border-blue-500 text-blue-600' : 'border-gray-200'}`}
                onClick={() => setWizardStep(step)}
              >
                Step {step}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className={`p-4 rounded-lg border ${wizardStep === 1 ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
            <p className="text-sm font-medium mb-2">1. Basics</p>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Connection name"
              value={dataSource.name}
              onChange={(e) => setDataSource({ ...dataSource, name: e.target.value })}
            />
            <select
              className="w-full mt-3 border rounded px-3 py-2 text-sm"
              value={dataSource.type}
              onChange={(e) => setDataSource({ ...dataSource, type: e.target.value })}
            >
              {['OPC UA', 'REST', 'WebSocket', 'gRPC', 'SQL'].map(option => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className={`p-4 rounded-lg border ${wizardStep === 2 ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
            <p className="text-sm font-medium mb-2">2. Endpoint</p>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder={endpointPlaceholders[dataSource.type] || 'Enter endpoint details'}
              value={dataSource.host}
              onChange={(e) => setDataSource({ ...dataSource, host: e.target.value })}
            />
            <textarea
              className="w-full mt-3 border rounded px-3 py-2 text-sm"
              rows="3"
              placeholder="Security notes or credentials"
              value={dataSource.notes}
              onChange={(e) => setDataSource({ ...dataSource, notes: e.target.value })}
            />
          </div>

          <div className={`p-4 rounded-lg border ${wizardStep === 3 ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
            <p className="text-sm font-medium mb-2">3. Review</p>
            <ul className="text-sm space-y-1 text-gray-700">
              <li className="flex items-center"><CheckCircle2 className="w-4 h-4 text-green-500 mr-2" />{dataSource.name || 'Unnamed source'}</li>
              <li className="flex items-center"><Database className="w-4 h-4 text-blue-500 mr-2" />{dataSource.type}</li>
              <li className="flex items-center"><Globe className="w-4 h-4 text-amber-500 mr-2" />{dataSource.host || 'No endpoint yet'}</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button onClick={goPrevStep} className="px-4 py-2 rounded border border-gray-300 text-sm">Back</button>
          {wizardStep < 3 ? (
            <button onClick={goNextStep} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Next</button>
          ) : (
            <button onClick={completeWizard} className="px-4 py-2 rounded bg-green-600 text-white text-sm">Create source</button>
          )}
        </div>
      </section>

      <section className="bg-white shadow border border-gray-200 rounded-xl p-6 grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">Quick connect</p>
            <h2 className="text-lg font-semibold">Connect instantly</h2>
            <p className="text-sm text-gray-600 mt-2">Paste a URL or connection string to fire a one-off probe.</p>
          </div>
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="mqtt://broker:1883 or opc.tcp://..."
            value={quickConnect.url}
            onChange={(e) => setQuickConnect({ ...quickConnect, url: e.target.value })}
          />
          {quickError && <p className="text-xs text-red-600">{quickError}</p>}
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Label"
            value={quickConnect.label}
            onChange={(e) => setQuickConnect({ ...quickConnect, label: e.target.value })}
          />
          <button
            onClick={() => handleQuickConnect()}
            className="w-full px-4 py-2 rounded bg-emerald-600 text-white text-sm flex items-center justify-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>Run connection test</span>
          </button>

          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-gray-500" />
                <span>Recent quick connects</span>
              </div>
              {quickHistory.length > 0 && (
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => setQuickHistory([])}
                >
                  Clear
                </button>
              )}
            </div>
            {quickHistory.length === 0 ? (
              <p className="text-xs text-gray-500">Run a test to populate your recent targets.</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto text-sm">
                {quickHistory.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <div className="font-medium">{entry.label || entry.url}</div>
                      <div className="text-xs text-gray-500 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{entry.ts.toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuickConnect(entry.url, entry.label)}
                      className="inline-flex items-center space-x-1 px-3 py-1 text-xs rounded bg-blue-600 text-white"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Re-run</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-gray-500 tracking-wide">Browser</p>
              <h2 className="text-lg font-semibold">Protocol explorer</h2>
            </div>
            <div className="flex space-x-2">
              {protocolOptions.map(protocol => (
                <button
                  key={protocol.id}
                  onClick={() => setSelectedProtocol(protocol.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm ${selectedProtocol === protocol.id ? 'border-blue-500 text-blue-600' : 'border-gray-200'}`}
                >
                  {protocol.icon}
                  <span>{protocol.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1 border rounded-lg p-3">
              <div className="flex items-center space-x-2 text-sm font-medium mb-2">
                <ListTree className="w-4 h-4 text-gray-500" />
                <span>Hierarchy</span>
              </div>
              <div className="space-y-2 text-sm">
                {(mockBrowseTrees[selectedProtocol] || []).map(node => (
                  <div key={node.id} className="border rounded p-2">
                    <div className="font-medium">{node.label}</div>
                    <div className="text-gray-500 text-xs">{node.children.join(', ')}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 border rounded-lg p-3 space-y-3">
              <div className="flex items-center space-x-2 text-sm font-medium">
                <Activity className="w-4 h-4 text-gray-500" />
                <span>Connection & data access log</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{logs.length} events recorded</p>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="flex items-center space-x-1 text-xs text-red-600 hover:underline"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear log</span>
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-sm text-gray-500 flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>Log is empty. Run a quick connect to see activity here.</span>
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="flex items-center justify-between text-sm border-b pb-1">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{log.message}</span>
                      </div>
                      <span className="text-xs text-gray-500">{log.ts.toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white shadow border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase text-gray-500 tracking-wide">Monitoring</p>
            <h2 className="text-xl font-semibold">Unified monitored items</h2>
            <p className="text-sm text-gray-600">Aggregate view combining all clients, connectors, sources and current values.</p>
          </div>
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              className="border rounded px-3 py-2 text-sm"
              placeholder="Filter items"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <span className="px-3 py-1 bg-white border rounded-full">Total: {stats.total}</span>
          <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full">Active: {stats.activeCount}</span>
          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full">Idle: {stats.idleCount}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                {['Client', 'Connector', 'Source', 'Name', 'Value', 'State'].map(col => (
                  <th key={col} className="px-3 py-2 text-left font-semibold border-b">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => (
                <tr key={`${item.source}-${index}`} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{item.client}</td>
                  <td className="px-3 py-2">{item.connector}</td>
                  <td className="px-3 py-2 font-mono text-xs">{item.source}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2">{item.value}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${item.state === 'Active' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {item.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4">
        <p className="text-sm text-gray-600 mb-2">Backend ready checks</p>
        <p className="text-xs text-gray-500">The existing UniversalTestClient is embedded below for full protocol coverage and backend interoperability.</p>
        <div className="mt-4 bg-white rounded-lg border border-gray-200">
          <UniversalTestClient />
        </div>
      </section>
    </div>
  )
}

export default ConnectionExperience
