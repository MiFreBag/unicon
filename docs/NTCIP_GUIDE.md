# NTCIP Protocol Guide

This guide covers how to use UNICON's NTCIP clients for Environmental Sensor Stations (ESS) and Variable Message Signs (VMS).

## Overview

NTCIP (National Transportation Communications for ITS Protocol) is a suite of standards for intelligent transportation systems. UNICON supports:
- **NTCIP 1204**: Environmental Sensor Stations (ESS) — Temperature, humidity, wind, precipitation, visibility
- **NTCIP 1203**: Variable Message Signs (VMS) — Display and message control

Both are accessed via SNMP (v2c or v3) and integrated as first-class protocol types in the connection manager.

## Connection Configuration

### NTCIP ESS (1204)

Create a new connection of type `ntcip-ess`:

```json
{
  "name": "Highway ESS-01",
  "type": "ntcip-ess",
  "config": {
    "host": "192.168.1.50",
    "port": 161,
    "version": "2c",
    "community": "public",
    "timeoutMs": 5000,
    "retries": 2
  }
}
```

**Fields:**
- `host`: IP or hostname of ESS device
- `port`: SNMP port (default 161)
- `version`: SNMP version — `"2c"` or `"3"`
- `community` (v2c): SNMP community string (typically "public")
- `username` (v3): SNMP v3 username
- `securityLevel` (v3): `"authPriv"`, `"authNoPriv"`, or `"noAuthNoPriv"`
- `authProtocol` (v3): `"sha"` or `"md5"`
- `authKey` (v3): Authentication passphrase
- `privProtocol` (v3): `"aes"` or `"des"`
- `privKey` (v3): Privacy passphrase
- `timeoutMs`: Request timeout (default 5000)
- `retries`: Retry count (default 2)

### NTCIP VMS (1203)

Create a new connection of type `ntcip-1203`:

```json
{
  "name": "Highway VMS-01",
  "type": "ntcip-1203",
  "config": {
    "host": "192.168.1.51",
    "port": 161,
    "version": "2c",
    "community": "public",
    "timeoutMs": 5000,
    "retries": 2
  }
}
```

Configuration options are identical to ESS.

## Operations

Once connected, use the `/operation` endpoint to interact with devices.

### ESS Operations

#### readSnapshot()
Retrieve current environmental data in one call:

```json
POST /operation
{
  "connectionId": "conn-id",
  "operation": "readSnapshot"
}
```

Response:
```json
{
  "success": true,
  "timestamp": "2026-01-22T10:30:00Z",
  "data": {
    "temperature": { "value": 23.5, "unit": "C", "precision": 0.1 },
    "humidity": { "value": 65, "unit": "%" },
    "windSpeed": { "value": 4.2, "unit": "m/s", "precision": 0.1 },
    "windDirection": { "value": 180, "unit": "degrees" },
    "precipitation": { "value": 0.5, "unit": "mm/hour" },
    "visibility": { "value": 1500, "unit": "meters" },
    "systemType": 1
  }
}
```

#### get(oids)
Retrieve specific OID values:

```json
POST /operation
{
  "connectionId": "conn-id",
  "operation": "get",
  "params": {
    "oids": ["1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0", "1.3.6.1.4.1.1206.4.2.3.3.3.2.1.0"]
  }
}
```

#### set(sets)
Set OID values:

```json
POST /operation
{
  "connectionId": "conn-id",
  "operation": "set",
  "params": {
    "sets": [
      { "oid": "1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0", "type": "Integer", "value": 245 }
    ]
  }
}
```

#### bulkGet(oids)
Alias for `get` — retrieve multiple OIDs.

#### getTable(baseOid)
Walk and retrieve a SNMP table starting at `baseOid`.

### VMS Operations

#### getStatus()
Retrieve current VMS status:

```json
POST /operation
{
  "connectionId": "conn-id",
  "operation": "getStatus"
}
```

Response:
```json
{
  "success": true,
  "timestamp": "2026-01-22T10:30:00Z",
  "data": {
    "signStatus": 1,
    "currentMessageNumber": 1,
    "currentMessageCRC": 12345,
    "errorStatus": 0,
    "brightness": 100,
    "systemType": 5
  }
}
```

#### setMessage(params)
Display a message on the VMS:

```json
POST /operation
{
  "connectionId": "conn-id",
  "operation": "setMessage",
  "params": {
    "messageText": "ROAD WORK AHEAD",
    "messageNumber": 1,
    "beacon": 1,
    "duration": 0
  }
}
```

**Parameters:**
- `messageText`: Message to display
- `messageNumber`: Message slot (typically 1-16 depending on device)
- `displayMode`: Display mode (see NTCIP 1203 spec; default 1)
- `duration`: Display duration in seconds (0 = indefinite)
- `beacon`: Beacon on/off (0 or 1)
- `pixelService`: Pixel service on/off (optional)

#### Custom OID Operations
Use `get`, `set`, `bulkGet`, or `getTable` for vendor-specific OIDs.

## OID Customization

Both handlers support custom OID maps via `connection.config.oidOverrides`. This allows you to adapt to vendor variations without changing code:

```json
{
  "name": "Custom ESS",
  "type": "ntcip-ess",
  "config": {
    "host": "192.168.1.50",
    "community": "public",
    "oidOverrides": {
      "essAirTemperature": "1.3.6.1.4.1.5555.4.2.1.1.0",
      "essRelativeHumidity": "1.3.6.1.4.1.5555.4.2.1.2.0"
    }
  }
}
```

## Error Handling

Common error codes:
- `NTCIP_TIMEOUT`: SNMP request timeout — check host/port
- `NTCIP_NETWORK`: Cannot reach device — verify network and firewall
- `NTCIP_AUTH`: Authentication failed — check community string (v2c) or credentials (v3)
- `NTCIP_CONNECT_ERROR`: General connection error

The `hint` field in error responses provides diagnostic guidance.

## Best Practices

1. **Test connectivity first** — Use `/connect` to verify the device is reachable
2. **Use readSnapshot for ESS** — More efficient than multiple individual gets
3. **Validate OIDs** — Test with a tool like `snmpget` before adding to UNICON
4. **SNMP v3 security** — Prefer v3 with authentication and encryption on untrusted networks
5. **Timeout and retries** — Adjust based on network latency and device responsiveness
6. **OID overrides** — Document vendor-specific OID mappings for your devices

## Integration with Node-RED

Example Node-RED flow for ESS polling:

```json
[
  {
    "id": "ess-polling-node",
    "type": "inject",
    "props": [{ "p": "payload" }],
    "repeat": "60",
    "crontab": "",
    "once": false,
    "payload": "{\"connectionId\": \"conn-ess-01\", \"operation\": \"readSnapshot\"}",
    "payloadType": "json"
  },
  {
    "id": "ess-http-request",
    "type": "http request",
    "method": "POST",
    "ret": "txt",
    "url": "http://localhost:3001/operation",
    "headers": {},
    "x": 200,
    "y": 100
  }
]
```

## Troubleshooting

### Connection fails with "timeout"
- Verify host and port are correct
- Check firewall rules allow SNMP (UDP 161)
- Test with `snmpget` from command line

### "Authentication failed"
- For v2c: Ensure community string matches device config
- For v3: Verify username and authentication key

### OIDs return "noSuchObject"
- OID may not exist on this device
- Check MIB documentation for your device model
- Use SNMP walk to enumerate available objects

### VMS message not displaying
- Verify `messageNumber` is valid for device
- Check device status with `getStatus` first
- Ensure message text fits display (check device specs)

## References

- [NTCIP 1203 Specification](https://www.its.dot.gov/standards/)
- [NTCIP 1204 Specification](https://www.its.dot.gov/standards/)
- [net-snmp JS Library](https://github.com/agentbl/node-snmp)
