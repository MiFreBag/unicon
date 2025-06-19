import React from 'react';
import { Server, Globe, Zap, MessageSquare, Code, Database } from 'lucide-react';

export const connectionTypes = {
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
      { name: 'password', label: 'Password', type: 'password', placeholder: '•••••••' }
    ]
  }
};
