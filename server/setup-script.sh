#!/bin/bash

# setup.sh - Universal Protocol Test Client Setup Script

set -e

echo "🚀 Universal Protocol Test Client Setup"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install Node.js 16+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        print_error "Node.js version 16+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    print_status "Node.js $(node --version) and npm $(npm --version) are installed."
}

# Setup project structure
setup_structure() {
    print_step "Setting up project structure..."
    
    mkdir -p universal-protocol-client
    cd universal-protocol-client
    
    # Create directories
    mkdir -p backend
    mkdir -p frontend
    mkdir -p data
    mkdir -p logs
    mkdir -p test-servers/{grpc,websocket,rest}
    mkdir -p monitoring/{prometheus,grafana}
    mkdir -p sql
    mkdir -p docs
    
    print_status "Project structure created."
}

# Setup backend
setup_backend() {
    print_step "Setting up backend..."
    
    cd backend
    
    # Create package.json if it doesn't exist
    if [ ! -f package.json ]; then
        cat > package.json << EOF
{
  "name": "universal-protocol-backend",
  "version": "1.0.0",
  "description": "Universal Protocol Test Client Backend Server",
  "main": "universal-server.js",
  "scripts": {
    "start": "node universal-server.js",
    "dev": "nodemon universal-server.js",
    "test": "jest",
    "lint": "eslint .",
    "docker:build": "docker build -t universal-backend .",
    "docker:run": "docker run -p 3001:3001 -p 8080:8080 universal-backend"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "ws": "^8.14.2",
    "uuid": "^9.0.1",
    "node-opcua": "^2.118.0",
    "axios": "^1.6.0",
    "@grpc/grpc-js": "^1.9.7",
    "@grpc/proto-loader": "^0.7.10",
    "mysql2": "^3.6.3",
    "pg": "^8.11.3",
    "sqlite3": "^5.1.6"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.7.0",
    "eslint": "^8.54.0"
  }
}
EOF
    fi
    
    # Install dependencies
    print_status "Installing backend dependencies..."
    npm install
    
    # Create environment file
    if [ ! -f .env ]; then
        cat > .env << EOF
# Universal Protocol Backend Configuration
NODE_ENV=development
PORT=3001
WS_PORT=8080
DATA_DIR=./data
LOG_LEVEL=debug

# Database configurations for testing
POSTGRES_URL=postgresql://testuser:testpass@localhost:5432/testdb
MYSQL_URL=mysql://testuser:testpass@localhost:3306/testdb
SQLITE_URL=./data/test.db

# OPC UA Test Server
OPCUA_TEST_SERVER=opc.tcp://localhost:62541

# gRPC Test Server
GRPC_TEST_SERVER=localhost:50051

# WebSocket Test Server
WS_TEST_SERVER=ws://localhost:8081
EOF
    fi
    
    cd ..
    print_status "Backend setup complete."
}

# Setup frontend
setup_frontend() {
    print_step "Setting up frontend..."
    
    if [ ! -d "frontend/node_modules" ]; then
        if ! command_exists yarn; then
            print_status "Creating Vite React app..."
            npm create vite@latest frontend -- --template react
        else
            print_status "Using Yarn to create Vite React app..."
            yarn create vite frontend --template react
        fi
    fi
    
    cd frontend
    
    # Install additional dependencies
    print_status "Installing frontend dependencies..."
    npm install tailwindcss lucide-react
    
    # Setup Tailwind CSS
    if [ ! -f tailwind.config.js ]; then
        npx tailwindcss init -p
        
        cat > tailwind.config.js << EOF
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF
    fi
    
    # Update main CSS file
    cat > src/index.css << EOF
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
EOF
    
    cd ..
    print_status "Frontend setup complete."
}

# Setup test servers
setup_test_servers() {
    print_step "Setting up test servers..."
    
    # Simple WebSocket test server
    cat > test-servers/websocket/server.js << EOF
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });

console.log('WebSocket test server running on port 8081');

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    ws.on('message', (message) => {
        console.log('Received:', message.toString());
        ws.send(\`Echo: \${message}\`);
    });
    
    // Send periodic messages
    const interval = setInterval(() => {
        ws.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
            data: Math.random()
        }));
    }, 5000);
    
    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(interval);
    });
});
EOF
    
    # Simple REST test server
    cat > test-servers/rest/server.js << EOF
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3002;

// Sample data
let users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
];

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'REST Test Server', timestamp: new Date().toISOString() });
});

app.get('/users', (req, res) => {
    res.json(users);
});

app.get('/users/:id', (req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
});

app.post('/users', (req, res) => {
    const user = {
        id: users.length + 1,
        name: req.body.name,
        email: req.body.email
    };
    users.push(user);
    res.status(201).json(user);
});

app.listen(PORT, () => {
    console.log(\`REST test server running on port \${PORT}\`);
});
EOF
    
    # SQL init script
    cat > sql/init.sql << EOF
-- Sample database schema for testing

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data
INSERT INTO users (username, email, first_name, last_name) VALUES
('johndoe', 'john@example.com', 'John', 'Doe'),
('janesmith', 'jane@example.com', 'Jane', 'Smith'),
('bobwilson', 'bob@example.com', 'Bob', 'Wilson');

INSERT INTO products (name, description, price, stock, category) VALUES
('Laptop', 'High-performance laptop', 999.99, 10, 'Electronics'),
('Mouse', 'Wireless mouse', 29.99, 50, 'Electronics'),
('Keyboard', 'Mechanical keyboard', 79.99, 25, 'Electronics'),
('Monitor', '4K monitor', 299.99, 15, 'Electronics');

INSERT INTO orders (user_id, total, status) VALUES
(1, 1029.98, 'completed'),
(2, 79.99, 'pending'),
(3, 329.98, 'shipped');
EOF
    
    print_status "Test servers setup complete."
}

# Setup monitoring
setup_monitoring() {
    print_step "Setting up monitoring..."
    
    # Prometheus configuration
    cat > monitoring/prometheus/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'universal-backend'
    static_configs:
      - targets: ['universal-backend:3001']
    metrics_path: '/api/metrics'
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF
    
    # Grafana dashboard configuration
    mkdir -p monitoring/grafana/provisioning/{dashboards,datasources}
    
    cat > monitoring/grafana/provisioning/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF
    
    print_status "Monitoring setup complete."
}

# Setup Docker environment
setup_docker() {
    print_step "Setting up Docker environment..."
    
    # Create Dockerfile for backend
    cat > backend/Dockerfile << EOF
FROM node:18-alpine

RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev musl-dev giflib-dev pixman-dev pangomm-dev libjpeg-turbo-dev freetype-dev

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN mkdir -p /app/data

EXPOSE 3001 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["npm", "start"]
EOF
    
    # Create health check script
    cat > backend/healthcheck.js << 'EOF'
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/health',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
EOF
    
    # Create Dockerfile for frontend
    cat > frontend/Dockerfile << EOF
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
    
    # Create nginx configuration
    cat > frontend/nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    add_header X-Frame-Options "ALLOWALL" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://universal-backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://universal-backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
EOF
    
    print_status "Docker environment setup complete."
}

# Create run scripts
create_scripts() {
    print_step "Creating run scripts..."
    
    # Development script
    cat > run-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Universal Protocol Test Client in Development Mode"

# Start backend
echo "Starting backend..."
cd backend
npm run dev &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Wait for Ctrl+C
echo "✅ Services started:"
echo "   Backend: http://localhost:3001"
echo "   Frontend: http://localhost:5174"
echo "   WebSocket: ws://localhost:8080"
echo ""
echo "Press Ctrl+C to stop all services"

trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
EOF
    
    # Production script
    cat > run-prod.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Universal Protocol Test Client with Docker"

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is required but not installed."
    exit 1
fi

echo "Starting services with Docker Compose..."
docker-compose up -d

echo "✅ Services started:"
echo "   Frontend: http://localhost"
echo "   Backend API: http://localhost:3001"
echo "   Grafana: http://localhost:3000 (admin/admin)"
echo "   Prometheus: http://localhost:9090"
echo ""
echo "To stop: docker-compose down"
echo "To view logs: docker-compose logs -f"
EOF
    
    # Make scripts executable
    chmod +x run-dev.sh run-prod.sh
    
    print_status "Run scripts created."
}

# Main setup function
main() {
    print_status "Starting Universal Protocol Test Client setup..."
    
    check_prerequisites
    setup_structure
    setup_backend
    setup_frontend
    setup_test_servers
    setup_monitoring
    setup_docker
    create_scripts
    
    echo ""
    echo "🎉 Setup Complete!"
    echo "================="
    echo ""
    echo "Next steps:"
    echo "1. Development mode: ./run-dev.sh"
    echo "2. Production mode: ./run-prod.sh"
    echo ""
    echo "Documentation:"
    echo "- Backend API: http://localhost:3001/api/health"
    echo "- Frontend: http://localhost:5174 (dev) or http://localhost (prod)"
    echo "- WebSocket: ws://localhost:8080"
    echo ""
    echo "Test Servers:"
    echo "- REST: http://localhost:3002"
    echo "- WebSocket: ws://localhost:8081"
    echo "- PostgreSQL: localhost:5432 (docker only)"
    echo "- MySQL: localhost:3306 (docker only)"
    echo ""
    echo "Monitoring (docker only):"
    echo "- Grafana: http://localhost:3000"
    echo "- Prometheus: http://localhost:9090"
    echo ""
    print_status "Happy testing! 🚀"
}

# Run main function
main "$@"