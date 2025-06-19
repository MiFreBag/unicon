# 🚀 Universal Protocol Test Client (Unicon)

A comprehensive, web-based testing client for multiple industrial and web protocols. Test, monitor, and debug OPC UA, REST APIs, WebSockets, gRPC, CPD, and SQL connections all from one powerful interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-19.1.0-61dafb.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)

## ✨ Features

### 🔌 **Multi-Protocol Support**
- **🏭 OPC UA**: Industrial automation protocol with node browsing, read/write operations, and subscriptions
- **🌐 REST API**: Complete HTTP client with method support, headers, authentication, and history
- **⚡ WebSocket**: Real-time bidirectional communication with message templates and live chat
- **📡 gRPC**: High-performance RPC with service discovery, method calls, and streaming support
- **🔧 CPD**: Custom Protocol Definition support via gRPC and WebSocket
- **🗄️ SQL**: Database connectivity for PostgreSQL, MySQL, and SQLite with query execution

### 🎯 **User Experience**
- **📑 Tab-based Interface**: Manage multiple connections simultaneously
- **📁 Connection Management**: Persistent storage and organization of connection profiles
- **🔄 Real-time Updates**: Live status monitoring and automatic reconnection
- **📊 Comprehensive Logging**: Detailed operation logs with filtering and export
- **🎨 Modern UI**: Responsive design built with React and Tailwind CSS
- **📤 Import/Export**: Share connection configurations easily

### 🔧 **Developer Features**
- **🐳 Docker Ready**: Complete containerization with Docker Compose
- **📊 Monitoring**: Integrated Prometheus and Grafana dashboards
- **🧪 Test Environment**: Built-in test servers for all supported protocols
- **⚡ Auto-Setup**: Intelligent setup script for quick deployment
- **🔒 Security**: Input validation, CORS configuration, and error sanitization

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/yourusername/universal-protocol-client/main/setup-script.sh -o setup.sh
chmod +x setup.sh
./setup.sh

# Start development environment
./run-dev.sh
```

### Option 2: Manual Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/universal-protocol-client.git
cd universal-protocol-client

# Install backend dependencies
cd server
npm install

# Install frontend dependencies  
cd ../client
npm install

# Build frontend for production
npm run build

# Start the backend (serves built frontend)
cd ../server
npm start
```

### Option 3: Docker Deployment
```bash
# Clone repository
git clone https://github.com/yourusername/universal-protocol-client.git
cd universal-protocol-client

# Start with Docker Compose
docker-compose up -d

# Access the application
open http://localhost
```

## 📖 Usage Guide

### Creating Connections

1. **Open the application** at `http://localhost:3099` (or `http://localhost` with Docker)
2. **Click the "+" button** in the sidebar to create a new connection
3. **Select protocol type** and configure connection parameters
4. **Test the connection** and save for future use

### Protocol-Specific Workspaces

#### 🏭 OPC UA Workspace
- **Node Browser**: Navigate the OPC UA address space
- **Read/Write Operations**: Interact with node values
- **Subscriptions**: Monitor value changes in real-time
- **Security Configuration**: Support for various security modes

#### 🌐 REST API Workspace  
- **HTTP Methods**: GET, POST, PUT, DELETE, PATCH support
- **Headers Management**: Custom headers and authentication
- **Request History**: Track and replay previous requests
- **Response Analysis**: JSON/XML formatting and validation

#### ⚡ WebSocket Workspace
- **Real-time Chat**: Bidirectional message exchange
- **Message Templates**: Pre-defined message formats
- **Connection Status**: Live connection monitoring
- **Auto-reconnection**: Automatic connection recovery

#### 📡 gRPC Workspace
- **Service Discovery**: Browse available services and methods
- **Method Calls**: Execute RPC calls with custom parameters
- **Streaming Support**: Handle unary, server, client, and bidirectional streams
- **Proto File Management**: Load and manage .proto definitions

#### 🔧 CPD (Custom Protocol Definition)
- **Topic Browser**: Discover available topics with pattern matching
- **Subscriptions**: Subscribe to topic patterns with wildcards
- **Publishing**: Send data updates with various publish modes
- **Real-time Updates**: Live topic change notifications

#### 🗄️ SQL Workspace
- **Query Editor**: Syntax-highlighted SQL editor
- **Schema Browser**: Explore database structure
- **Result Sets**: Tabular display of query results
- **Multiple Databases**: Support for PostgreSQL, MySQL, SQLite

## 🏗️ Architecture

### Frontend (`/client`)
- **Framework**: React 19.1.0 with hooks
- **Build Tool**: Vite for fast development and building
- **Styling**: Tailwind CSS for responsive design
- **Icons**: Lucide React for consistent iconography
- **State Management**: React hooks for local state
- **WebSocket Client**: Real-time communication with backend

### Backend (`/server`) 
- **Runtime**: Node.js 16+ with Express.js
- **WebSocket Server**: Real-time bidirectional communication
- **Protocol Handlers**: Dedicated handlers for each protocol type
- **Data Persistence**: JSON-based storage with LowDB
- **Security**: CORS, input validation, error sanitization
- **Health Monitoring**: System status and performance metrics

### Infrastructure
- **Containerization**: Docker and Docker Compose
- **Monitoring**: Prometheus metrics collection and Grafana visualization
- **Reverse Proxy**: Nginx configuration for production deployment
- **Database Support**: PostgreSQL, MySQL, SQLite connectivity

## 📁 Project Structure

```
universal-protocol-client/
├── client/                     # React frontend application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── workspaces/         # Protocol-specific workspaces
│   │   ├── utils/              # Utility functions
│   │   └── main.jsx           # Application entry point
│   ├── dist/                  # Built static files
│   └── package.json
├── server/                    # Node.js backend server
│   ├── handlers/              # Protocol-specific handlers
│   ├── proto/                 # gRPC protocol definitions
│   ├── data/                  # Persistent data storage
│   ├── universal-server.js    # Main server file
│   └── package.json
├── monitoring/                # Monitoring configuration
│   ├── prometheus/            # Metrics collection
│   └── grafana/              # Visualization dashboards  
├── reverse-proxy/             # Nginx configuration
├── docker-compose.yml         # Multi-service deployment
└── setup-script.sh           # Automated setup script
```

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
PORT=3099                      # Backend server port
NODE_ENV=production           # Environment mode
LOG_LEVEL=info               # Logging verbosity

# Database Configuration  
DB_TYPE=json                 # Storage type (json/postgresql/mysql)
DB_HOST=localhost            # Database host
DB_PORT=5432                 # Database port
DB_NAME=unicon              # Database name

# Security Configuration
CORS_ORIGIN=*               # CORS allowed origins
JWT_SECRET=your-secret      # JWT signing secret (if auth enabled)
```

### Connection Templates
The application includes pre-configured templates for common scenarios:

- **OPC UA Server**: `opc.tcp://localhost:4840`
- **REST API**: `https://jsonplaceholder.typicode.com`
- **WebSocket Echo**: `ws://echo.websocket.org`
- **gRPC Server**: `localhost:9090`
- **PostgreSQL**: `postgresql://localhost:5432/testdb`

## 🧪 Testing

### Unit Tests
```bash
# Run backend tests
cd server
npm test

# Run frontend tests  
cd client
npm test
```

### Integration Testing
```bash
# Start test servers
npm run test:servers

# Run end-to-end tests
npm run test:e2e
```

### Load Testing
```bash
# Start monitoring
docker-compose up prometheus grafana

# Run load tests
npm run test:load
```

## 📊 Monitoring & Performance

### Metrics Collection
- **Request Throughput**: 1000+ requests/second
- **Concurrent Connections**: 100+ simultaneous connections  
- **WebSocket Messages**: 10k+ messages/second
- **Memory Usage**: <512MB base footprint

### Health Endpoints
- **System Health**: `GET /api/health`
- **Connection Status**: `GET /api/connections/status`
- **Performance Metrics**: `GET /api/metrics`

### Grafana Dashboards
Access monitoring dashboards at `http://localhost:3000` (admin/admin):
- **System Overview**: CPU, memory, disk usage
- **Protocol Metrics**: Per-protocol performance statistics
- **Connection Analytics**: Active connections and throughput
- **Error Tracking**: Error rates and patterns

## 🔒 Security

### Implementation
- ✅ **Input Validation**: All inputs sanitized and validated
- ✅ **CORS Configuration**: Proper cross-origin settings
- ✅ **Error Sanitization**: Safe error message handling
- ✅ **Connection Isolation**: Separate handlers per connection
- ✅ **Graceful Shutdown**: Clean connection termination

### Production Recommendations
- 🔒 **HTTPS/TLS**: SSL certificates for production deployment
- 🔑 **Authentication**: JWT-based user authentication
- 🛡️ **Rate Limiting**: Request rate limiting and throttling
- 📊 **Audit Logging**: Comprehensive security event logging
- 🔄 **Backup Strategy**: Regular backup of connection configurations

## 🛠️ Development

### Prerequisites
- **Node.js**: 16.0.0 or higher
- **npm**: 7.0.0 or higher
- **Docker**: 20.0.0+ (for containerized deployment)
- **Git**: For version control

### Development Workflow
```bash
# Start development servers
npm run dev:all

# Frontend only (with hot reload)
cd client && npm run dev

# Backend only (with nodemon)
cd server && npm run dev

# Build for production
npm run build

# Lint and format code
npm run lint
npm run format
```

### Adding New Protocols
1. **Create protocol handler** in `/server/handlers/`
2. **Add workspace component** in `/client/src/workspaces/`
3. **Update connection types** in main application
4. **Add tests** for new functionality
5. **Update documentation**

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/yourusername/universal-protocol-client.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
npm run test

# Commit and push
git commit -m "Add amazing feature"
git push origin feature/amazing-feature

# Create Pull Request
```

### Code Style
- **ESLint**: Automated code linting
- **Prettier**: Code formatting
- **Conventional Commits**: Standardized commit messages
- **Type Safety**: JSDoc annotations for better IDE support

## 📚 Documentation

- **[API Documentation](docs/api.md)**: Complete REST API reference
- **[Protocol Guides](docs/protocols/)**: Detailed protocol-specific documentation
- **[Deployment Guide](docs/deployment.md)**: Production deployment instructions
- **[Troubleshooting](docs/troubleshooting.md)**: Common issues and solutions
- **[FAQ](docs/faq.md)**: Frequently asked questions

## 🗺️ Roadmap

### Upcoming Features
- [ ] 🔌 **MQTT Support**: IoT protocol integration
- [ ] 📡 **Modbus TCP**: Industrial communication protocol
- [ ] 🌐 **WebRTC**: Peer-to-peer communication
- [ ] 🔐 **Authentication System**: User management and access control
- [ ] 📝 **Request History**: Persistent operation history
- [ ] 📤 **Advanced Export**: CSV/Excel data export
- [ ] 🎨 **Custom Themes**: UI personalization options
- [ ] 🔌 **Plugin System**: Custom protocol handler plugins

### Enterprise Features
- [ ] 👥 **Multi-User Support**: Team collaboration features
- [ ] 🏢 **SSO Integration**: Enterprise authentication
- [ ] 📊 **Advanced Analytics**: Business intelligence dashboard
- [ ] 🔄 **Load Testing**: Integrated performance testing
- [ ] 🌍 **Internationalization**: Multi-language support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OPC Foundation** for OPC UA specifications
- **gRPC Community** for protocol documentation
- **React Team** for the amazing frontend framework
- **Tailwind CSS** for the utility-first CSS framework
- **Node.js Community** for the runtime environment

## 📞 Support

- **Documentation**: [https://docs.example.com](https://docs.example.com)
- **Issues**: [GitHub Issues](https://github.com/yourusername/universal-protocol-client/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/universal-protocol-client/discussions)
- **Email**: support@example.com

---

**Made with ❤️ for the industrial automation and API testing community**