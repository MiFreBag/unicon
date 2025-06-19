# 🔌 CPD (Custom Protocol Definition) Integration

## 🎯 **CPD Client wurde erfolgreich integriert!**

Der Universal Protocol Test Client unterstützt jetzt auch **CPD (Custom Protocol Definition)** sowohl über **gRPC** als auch **WebSocket**.

## ✨ **CPD Features**

### **🔧 Unterstützte Operationen:**
- **Ping**: Verbindungstest mit dem CPD-Adapter
- **Subscribe/Unsubscribe**: Topic-basierte Subscriptions mit Pattern-Matching
- **Publish**: Verschiedene Publish-Modi (publish, publishUpdate, deltaPublish)
- **Browse Topics**: Topic-Discovery mit Wildcard-Support
- **Get Latest Data**: Abrufen der neuesten Daten für Topic-Patterns

### **🌐 Protokoll-Support:**
- **gRPC**: Direkte gRPC-Verbindung zum CPD-Adapter
- **WebSocket**: WebSocket-basierte Verbindung für Browser-Kompatibilität

### **📊 CPD Workspace Features:**
- **Topic Browser**: Durchsuchen verfügbarer Topics mit Pattern-Matching
- **Live Subscriptions**: Real-time Topic-Updates
- **Message History**: Vollständige Nachrichtenverfolgung
- **Publish Interface**: Einfaches Publizieren von Daten
- **Connection Test**: Ping-Funktionalität für Verbindungstests

## 🚀 **Setup & Verwendung**

### **1. CPD Connection erstellen**

```javascript
{
  name: "CPD Adapter (gRPC)",
  type: "cpd",
  config: {
    protocol: "grpc",
    address: "localhost:8082",
    useTls: false,
    defaultTopics: "sw.sensors.#\nsw.assets.#"
  }
}
```

### **2. WebSocket CPD Connection**

```javascript
{
  name: "CPD Adapter (WebSocket)",
  type: "cpd", 
  config: {
    protocol: "websocket",
    url: "ws://10.100.100.10:8003",
    useTls: false,
    defaultTopics: "sw.sensors.#\nsw.tunnel.*"
  }
}
```

### **3. Topic Pattern Beispiele**

```bash
# Alle Sensoren
sw.sensors.#

# Spezifische Tunnel
sw.tunnel.*

# Einzelne Assets
sw.assets.machine1

# Kombinierte Patterns
sw.sensors.temperature.#
sw.sensors.pressure.*
sw.assets.conveyor.status
```

## 🔌 **Backend Integration**

### **CPD Handler Features:**
- ✅ **Dual Protocol Support**: gRPC + WebSocket
- ✅ **MQTT-Style Topic Matching**: Unterstützt `#` und `*` Wildcards
- ✅ **Subscription Management**: Automatisches Lifecycle-Management
- ✅ **Real-time Updates**: Live Topic-Change-Broadcasting
- ✅ **Error Handling**: Robuste Fehlerbehandlung

### **Proto Definition:**
```bash
# backend/proto/cpd.proto
# (Vollständige CPD Proto-Definition verfügbar)
```

### **API Endpoints:**
```bash
# Ping
POST /api/operation
{
  "connectionId": "uuid",
  "operation": "ping",
  "params": {"message": "test"}
}

# Subscribe
POST /api/operation
{
  "connectionId": "uuid", 
  "operation": "simpleSubscribe",
  "params": {
    "id": 12345,
    "topicPatterns": ["sw.sensors.#", "sw.assets.*"]
  }
}

# Publish
POST /api/operation
{
  "connectionId": "uuid",
  "operation": "publish", 
  "params": {
    "topic": "sw.sensor.temperature",
    "data": {"value": 23.5, "unit": "°C"},
    "mode": "publish"
  }
}

# Browse Topics
POST /api/operation
{
  "connectionId": "uuid",
  "operation": "browseTopics",
  "params": {
    "topicPattern": "sw.*",
    "limit": 100
  }
}
```

## 🎨 **Frontend CPD Workspace**

### **Tab-basierte Benutzeroberfläche:**

#### **📋 Topics & Browse Tab:**
- **Connection Test**: Ping-Funktionalität
- **Topic Browser**: Durchsuc