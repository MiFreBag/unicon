/**
 * NTCIP 1204 Environmental Sensor Station (ESS) Handler
 * Communicates with ESS devices via SNMP (v2c or v3)
 */

const snmp = require('net-snmp');

// Common NTCIP 1204 ESS OIDs (baseline, can be overridden per connection)
const DEFAULT_ESS_OIDS = {
  // Device identification and status
  essSystemGroup: '1.3.6.1.4.1.1206.4.2.3.3.1',
  essSystemVersion: '1.3.6.1.4.1.1206.4.2.3.3.1.1.0',
  essSystemType: '1.3.6.1.4.1.1206.4.2.3.3.1.2.0',
  
  // Environmental data group
  essEnvironmentalData: '1.3.6.1.4.1.1206.4.2.3.3.3',
  essAirTemperature: '1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0', // in 0.1 degree C
  essRelativeHumidity: '1.3.6.1.4.1.1206.4.2.3.3.3.2.1.0', // percentage
  essWindSpeed: '1.3.6.1.4.1.1206.4.2.3.3.3.3.1.0', // in 0.1 m/s
  essWindDirection: '1.3.6.1.4.1.1206.4.2.3.3.3.3.2.0', // degrees (0-359)
  essPrecipitationRate: '1.3.6.1.4.1.1206.4.2.3.3.3.4.1.0', // mm/hour
  essVisibility: '1.3.6.1.4.1.1206.4.2.3.3.3.5.1.0', // meters
  
  // Sensor status
  essDataStatus: '1.3.6.1.4.1.1206.4.2.3.3.3.6.0',
  essAirTemperatureStatus: '1.3.6.1.4.1.1206.4.2.3.3.3.1.2.0',
  essHumidityStatus: '1.3.6.1.4.1.1206.4.2.3.3.3.2.2.0',
};

class NTCIPESSHandler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId;
    this.config = config;
    this.session = null;
    
    // Merge user OID overrides
    this.oids = { ...DEFAULT_ESS_OIDS, ...(config.oidOverrides || {}) };
  }

  async connect() {
    try {
      const {
        host = 'localhost',
        port = 161,
        version = '2c',
        community = 'public',
        securityLevel = 'authPriv',
        authProtocol = 'sha',
        authKey = '',
        privProtocol = 'aes',
        privKey = '',
        engineID,
        timeoutMs = 5000,
        retries = 2
      } = this.config;

      if (!host) throw new Error('host is required');

      // Create SNMP session based on version
      if (version === '3') {
        // SNMPv3
        const options = {
          version: snmp.Version3,
          engineID: engineID || snmp.createV3EngineID(),
          username: this.config.username || 'admin',
          securityLevel: securityLevel,
          authProtocol: authProtocol === 'md5' ? snmp.AuthProtocols.md5 : snmp.AuthProtocols.sha,
          authKey: authKey || Buffer.alloc(16),
          privProtocol: privProtocol === 'des' ? snmp.PrivProtocols.des : snmp.PrivProtocols.aes,
          privKey: privKey || Buffer.alloc(16),
          timeout: timeoutMs,
          retries: retries
        };
        this.session = snmp.createV3Session(host, options);
      } else {
        // SNMPv2c (default)
        this.session = snmp.createSession(host, community, {
          version: snmp.Version2c,
          port: port,
          timeout: timeoutMs,
          retries: retries
        });
      }

      // Test connection with a simple get
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.session?.close?.();
          this.session = null;
          reject(new Error('SNMP connect timeout'));
        }, timeoutMs + 1000);

        this.session.get([this.oids.essSystemVersion], (err, varbinds) => {
          clearTimeout(timeout);
          if (err) {
            this.session?.close?.();
            this.session = null;
            reject(new Error(`SNMP connection failed: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new Error(`ESS connect error: ${error.message}`);
    }
  }

  async disconnect() {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }

  /**
   * Get raw OID values
   * @param {string[]} oids - Array of OID strings
   * @returns {Promise<object>} Map of OID -> value
   */
  async get(oids) {
    return new Promise((resolve, reject) => {
      if (!this.session) return reject(new Error('Not connected'));
      
      this.session.get(oids, (err, varbinds) => {
        if (err) return reject(new Error(`SNMP get error: ${err.message}`));
        
        const result = {};
        varbinds.forEach(vb => {
          result[vb.oid] = this._parseVarbind(vb);
        });
        resolve(result);
      });
    });
  }

  /**
   * Set OID values
   * @param {object[]} sets - Array of {oid, type, value}
   * @returns {Promise<object>} Confirmation
   */
  async set(sets) {
    return new Promise((resolve, reject) => {
      if (!this.session) return reject(new Error('Not connected'));

      // Convert to varbinds
      const varbinds = sets.map(s => {
        const vb = { oid: s.oid };
        switch ((s.type || '').toLowerCase()) {
          case 'integer':
          case 'int':
            vb.type = snmp.ObjectType.Integer;
            vb.value = parseInt(s.value, 10);
            break;
          case 'octetstring':
          case 'string':
            vb.type = snmp.ObjectType.OctetString;
            vb.value = String(s.value);
            break;
          case 'oid':
          case 'objectid':
            vb.type = snmp.ObjectType.ObjectIdentifier;
            vb.value = s.value;
            break;
          default:
            vb.type = snmp.ObjectType.Integer;
            vb.value = parseInt(s.value, 10);
        }
        return vb;
      });

      this.session.set(varbinds, (err) => {
        if (err) return reject(new Error(`SNMP set error: ${err.message}`));
        resolve({ success: true });
      });
    });
  }

  /**
   * Bulk get – retrieve multiple OIDs
   * @param {string[]} oids 
   * @returns {Promise<object>}
   */
  async bulkGet(oids) {
    return this.get(oids);
  }

  /**
   * Get table – walk a table base OID
   * @param {string} baseOid 
   * @returns {Promise<object[]>}
   */
  async getTable(baseOid) {
    return new Promise((resolve, reject) => {
      if (!this.session) return reject(new Error('Not connected'));

      const rows = [];
      this.session.walk(baseOid, 10, (err, varbinds) => {
        if (err) return reject(new Error(`SNMP walk error: ${err.message}`));

        varbinds.forEach(vb => {
          rows.push({
            oid: vb.oid,
            value: this._parseVarbind(vb)
          });
        });
        resolve(rows);
      });
    });
  }

  /**
   * Read ESS environmental snapshot
   * Gathers common ESS data into a user-friendly object
   * @returns {Promise<object>} Snapshot with temperature, humidity, wind, precip, visibility
   */
  async readSnapshot() {
    try {
      const oidList = [
        this.oids.essAirTemperature,
        this.oids.essRelativeHumidity,
        this.oids.essWindSpeed,
        this.oids.essWindDirection,
        this.oids.essPrecipitationRate,
        this.oids.essVisibility,
        this.oids.essSystemType
      ];

      const result = await this.get(oidList);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          temperature: {
            value: result[this.oids.essAirTemperature],
            unit: 'C',
            precision: 0.1
          },
          humidity: {
            value: result[this.oids.essRelativeHumidity],
            unit: '%'
          },
          windSpeed: {
            value: result[this.oids.essWindSpeed],
            unit: 'm/s',
            precision: 0.1
          },
          windDirection: {
            value: result[this.oids.essWindDirection],
            unit: 'degrees'
          },
          precipitation: {
            value: result[this.oids.essPrecipitationRate],
            unit: 'mm/hour'
          },
          visibility: {
            value: result[this.oids.essVisibility],
            unit: 'meters'
          },
          systemType: result[this.oids.essSystemType]
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse a varbind into a user-friendly value
   * @private
   */
  _parseVarbind(vb) {
    if (!vb) return null;
    
    // Handle different SNMP types
    if (Buffer.isBuffer(vb.value)) {
      return vb.value.toString();
    }
    
    // For integers and OIDs
    return vb.value;
  }
}

module.exports = NTCIPESSHandler;
