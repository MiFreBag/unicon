const NTCIPESSHandler = require('../handlers/ntcip_ess_handler');
const NTCIPVMS1203Handler = require('../handlers/ntcip_vms_1203_handler');

// Mock net-snmp module
jest.mock('net-snmp', () => ({
  createSession: jest.fn((host, community, opts) => ({
    get: jest.fn((oids, callback) => {
      setTimeout(() => {
        const varbinds = oids.map(oid => ({
          oid,
          value: oid.includes('Temperature') ? 235 : 65,
          type: 2
        }));
        callback(null, varbinds);
      }, 10);
    }),
    set: jest.fn((varbinds, callback) => {
      setTimeout(() => callback(null), 10);
    }),
    walk: jest.fn((baseOid, maxReps, callback) => {
      setTimeout(() => {
        const varbinds = [
          { oid: `${baseOid}.1`, value: 'row1' },
          { oid: `${baseOid}.2`, value: 'row2' }
        ];
        callback(null, varbinds);
      }, 10);
    }),
    close: jest.fn()
  })),
  createV3Session: jest.fn((host, opts) => ({
    get: jest.fn((oids, callback) => {
      setTimeout(() => {
        const varbinds = oids.map(oid => ({
          oid,
          value: 100,
          type: 2
        }));
        callback(null, varbinds);
      }, 10);
    }),
    set: jest.fn((varbinds, callback) => {
      setTimeout(() => callback(null), 10);
    }),
    close: jest.fn()
  })),
  Version2c: 1,
  Version3: 3,
  ObjectType: {
    Integer: 2,
    OctetString: 4,
    ObjectIdentifier: 6
  },
  AuthProtocols: {
    md5: 'md5',
    sha: 'sha'
  },
  PrivProtocols: {
    des: 'des',
    aes: 'aes'
  },
  createV3EngineID: jest.fn(() => Buffer.from('engineid'))
}));

describe('NTCIP ESS Handler', () => {
  let handler;

  beforeEach(() => {
    handler = new NTCIPESSHandler('test-conn-1', {
      host: '192.168.1.50',
      port: 161,
      version: '2c',
      community: 'public',
      timeoutMs: 5000,
      retries: 2
    });
  });

  test('should initialize with correct config', () => {
    expect(handler.connectionId).toBe('test-conn-1');
    expect(handler.config.host).toBe('192.168.1.50');
    expect(handler.session).toBeNull();
  });

  test('should connect successfully with SNMPv2c', async () => {
    await handler.connect();
    expect(handler.session).not.toBeNull();
  });

  test('should handle connection with SNMPv3', async () => {
    const v3handler = new NTCIPESSHandler('test-conn-v3', {
      host: '192.168.1.51',
      version: '3',
      username: 'admin',
      authKey: 'password123',
      privKey: 'privpass123'
    });

    await v3handler.connect();
    expect(v3handler.session).not.toBeNull();
  });

  test('should get OID values', async () => {
    await handler.connect();
    const result = await handler.get(['1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0']);
    expect(Object.keys(result)).toContain('1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0');
  });

  test('should set OID values', async () => {
    await handler.connect();
    const result = await handler.set([
      { oid: '1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0', type: 'Integer', value: 245 }
    ]);
    expect(result.success).toBe(true);
  });

  test('should perform bulk get', async () => {
    await handler.connect();
    const oids = [
      '1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0',
      '1.3.6.1.4.1.1206.4.2.3.3.3.2.1.0'
    ];
    const result = await handler.bulkGet(oids);
    expect(Object.keys(result).length).toBe(2);
  });

  test('should walk table', async () => {
    await handler.connect();
    const result = await handler.getTable('1.3.6.1.4.1.1206.4.2.3.3.3');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should read environmental snapshot', async () => {
    await handler.connect();
    const result = await handler.readSnapshot();
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('temperature');
    expect(result.data).toHaveProperty('humidity');
    expect(result.data).toHaveProperty('windSpeed');
    expect(result.data).toHaveProperty('precipitation');
    expect(result.data).toHaveProperty('visibility');
  });

  test('should disconnect cleanly', async () => {
    await handler.connect();
    await handler.disconnect();
    expect(handler.session).toBeNull();
  });

  test('should throw error if not connected when calling get', async () => {
    const disconnectedHandler = new NTCIPESSHandler('test-conn-2', { host: '192.168.1.50' });
    await expect(disconnectedHandler.get(['1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0'])).rejects.toThrow('Not connected');
  });

  test('should support OID overrides', () => {
    const customHandler = new NTCIPESSHandler('test-custom', {
      host: '192.168.1.50',
      oidOverrides: {
        essAirTemperature: '1.3.6.1.4.1.9999.1.1.1.0'
      }
    });
    expect(customHandler.oids.essAirTemperature).toBe('1.3.6.1.4.1.9999.1.1.1.0');
  });
});

describe('NTCIP VMS 1203 Handler', () => {
  let handler;

  beforeEach(() => {
    handler = new NTCIPVMS1203Handler('test-vms-1', {
      host: '192.168.1.51',
      port: 161,
      version: '2c',
      community: 'public',
      timeoutMs: 5000,
      retries: 2
    });
  });

  test('should initialize with correct config', () => {
    expect(handler.connectionId).toBe('test-vms-1');
    expect(handler.config.host).toBe('192.168.1.51');
    expect(handler.session).toBeNull();
  });

  test('should connect successfully', async () => {
    await handler.connect();
    expect(handler.session).not.toBeNull();
  });

  test('should get status', async () => {
    await handler.connect();
    const result = await handler.getStatus();
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('signStatus');
    expect(result.data).toHaveProperty('currentMessageNumber');
    expect(result.data).toHaveProperty('brightness');
  });

  test('should set message on VMS', async () => {
    await handler.connect();
    const result = await handler.setMessage({
      messageText: 'ROAD WORK AHEAD',
      messageNumber: 1,
      beacon: 1
    });
    expect(result.success).toBe(true);
    expect(result.messageText).toBe('ROAD WORK AHEAD');
  });

  test('should get OID values', async () => {
    await handler.connect();
    const result = await handler.get(['1.3.6.1.4.1.1206.4.2.3.5.3.1.0']);
    expect(Object.keys(result)).toContain('1.3.6.1.4.1.1206.4.2.3.5.3.1.0');
  });

  test('should set OID values', async () => {
    await handler.connect();
    const result = await handler.set([
      { oid: '1.3.6.1.4.1.1206.4.2.3.5.3.5.0', type: 'Integer', value: 100 }
    ]);
    expect(result.success).toBe(true);
  });

  test('should walk table', async () => {
    await handler.connect();
    const result = await handler.getTable('1.3.6.1.4.1.1206.4.2.3.5.4.1');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test('should encode multi-string message', () => {
    const encoded = handler.encodeMultiString('NORMAL TEXT');
    expect(encoded).toBe('NORMAL TEXT');
  });

  test('should disconnect cleanly', async () => {
    await handler.connect();
    await handler.disconnect();
    expect(handler.session).toBeNull();
  });

  test('should throw error if not connected', async () => {
    const disconnectedHandler = new NTCIPVMS1203Handler('test-vms-2', { host: '192.168.1.51' });
    await expect(disconnectedHandler.get(['1.3.6.1.4.1.1206.4.2.3.5.3.1.0'])).rejects.toThrow('Not connected');
  });

  test('should support SNMPv3', async () => {
    const v3handler = new NTCIPVMS1203Handler('test-vms-v3', {
      host: '192.168.1.52',
      version: '3',
      username: 'admin',
      authKey: 'authpass',
      privKey: 'privpass'
    });

    await v3handler.connect();
    expect(v3handler.session).not.toBeNull();
  });

  test('should support OID overrides', () => {
    const customHandler = new NTCIPVMS1203Handler('test-vms-custom', {
      host: '192.168.1.51',
      oidOverrides: {
        vmsMessageText: '1.3.6.1.4.1.9999.5.4.1.2.1.0'
      }
    });
    expect(customHandler.oids.vmsMessageText).toBe('1.3.6.1.4.1.9999.5.4.1.2.1.0');
  });
});
