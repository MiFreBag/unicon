/**
 * NTCIP 1203 Variable Message Sign (VMS) Handler
 * Communicates with VMS devices via SNMP (v2c or v3)
 */

const snmp = require('net-snmp');

// Common NTCIP 1203 VMS OIDs (baseline, can be overridden per connection)
const DEFAULT_VMS_OIDS = {
  // Device status and control
  vmsSystemGroup: '1.3.6.1.4.1.1206.4.2.3.5.1',
  vmsSystemVersion: '1.3.6.1.4.1.1206.4.2.3.5.1.1.0',
  vmsSystemType: '1.3.6.1.4.1.1206.4.2.3.5.1.2.0',
  
  // Message control
  vmsMessageControl: '1.3.6.1.4.1.1206.4.2.3.5.2',
  
  // Sign status
  vmsSignStatus: '1.3.6.1.4.1.1206.4.2.3.5.3.1.0',
  vmsCurrentMessageNumber: '1.3.6.1.4.1.1206.4.2.3.5.3.2.0',
  vmsCurrentMessageCRC: '1.3.6.1.4.1.1206.4.2.3.5.3.3.0',
  vmsErrorStatus: '1.3.6.1.4.1.1206.4.2.3.5.3.4.0',
  vmsSignBrightness: '1.3.6.1.4.1.1206.4.2.3.5.3.5.0',
  
  // Message table
  vmsMessageTable: '1.3.6.1.4.1.1206.4.2.3.5.4.1',
  vmsMessageNumberEntry: '1.3.6.1.4.1.1206.4.2.3.5.4.1.1.1',
  vmsMessageText: '1.3.6.1.4.1.1206.4.2.3.5.4.1.2.1.0',
  vmsMessageBeacon: '1.3.6.1.4.1.1206.4.2.3.5.4.1.3.1.0',
  vmsMessagePixelService: '1.3.6.1.4.1.1206.4.2.3.5.4.1.4.1.0',
  vmsMessageRunwayEntry: '1.3.6.1.4.1.1206.4.2.3.5.4.1.5.1.0',
  
  // Multi-string table
  vmsMultiStringTable: '1.3.6.1.4.1.1206.4.2.3.5.5.1',
  vmsMultiStringIndex: '1.3.6.1.4.1.1206.4.2.3.5.5.1.1',
  vmsMultiString: '1.3.6.1.4.1.1206.4.2.3.5.5.1.2',
  
  // Font table
  vmsFontTable: '1.3.6.1.4.1.1206.4.2.3.5.6.1',
};

// MUTCD Multi-String formatting codes (7-bit ASCII)
const FORMATTING_CODES = {
  NEWLINE: '[nl]',
  BOLD: '[b]',
  BOLD_OFF: '[/b]',
  ITALIC: '[i]',
  ITALIC_OFF: '[/i]',
  FLASH: '[f]',
  FLASH_OFF: '[/f]',
};

class NTCIPVMS1203Handler {
  constructor(connectionId, config = {}) {
    this.connectionId = connectionId;
    this.config = config;
    this.session = null;
    
    // Merge user OID overrides
    this.oids = { ...DEFAULT_VMS_OIDS, ...(config.oidOverrides || {}) };
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

        this.session.get([this.oids.vmsSystemVersion], (err, varbinds) => {
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
      throw new Error(`VMS connect error: ${error.message}`);
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
   * Get current VMS status
   * @returns {Promise<object>} Device status, current message, errors
   */
  async getStatus() {
    try {
      const oidList = [
        this.oids.vmsSignStatus,
        this.oids.vmsCurrentMessageNumber,
        this.oids.vmsCurrentMessageCRC,
        this.oids.vmsErrorStatus,
        this.oids.vmsSignBrightness,
        this.oids.vmsSystemType
      ];

      const result = await this.get(oidList);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          signStatus: result[this.oids.vmsSignStatus],
          currentMessageNumber: result[this.oids.vmsCurrentMessageNumber],
          currentMessageCRC: result[this.oids.vmsCurrentMessageCRC],
          errorStatus: result[this.oids.vmsErrorStatus],
          brightness: result[this.oids.vmsSignBrightness],
          systemType: result[this.oids.vmsSystemType]
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
   * Set a message on the VMS
   * @param {object} params - Message parameters
   * @param {string} params.messageText - Plain text message
   * @param {number} [params.messageNumber=1] - Message ID
   * @param {number} [params.displayMode=1] - Display mode (see NTCIP 1203)
   * @param {number} [params.duration=0] - Duration in seconds (0 = indefinite)
   * @param {number} [params.beacon=0] - Beacon on/off
   * @param {number} [params.pixelService=0] - Pixel service on/off
   * @returns {Promise<object>} Confirmation
   */
  async setMessage(params) {
    try {
      const {
        messageText = '',
        messageNumber = 1,
        displayMode = 1,
        duration = 0,
        beacon = 0,
        pixelService = 0
      } = params || {};

      // Build the sets array
      const sets = [
        {
          oid: `${this.oids.vmsMessageText}.${messageNumber}`,
          type: 'OctetString',
          value: messageText
        },
        {
          oid: `${this.oids.vmsMessageBeacon}.${messageNumber}`,
          type: 'Integer',
          value: beacon
        }
      ];

      // If pixel service is supported, add it
      if (pixelService !== undefined) {
        sets.push({
          oid: `${this.oids.vmsMessagePixelService}.${messageNumber}`,
          type: 'Integer',
          value: pixelService
        });
      }

      // Perform the set operation
      await this.set(sets);

      return {
        success: true,
        messageNumber,
        messageText,
        displayMode,
        duration,
        beacon,
        pixelService
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Encode a user-friendly message with MUTCD formatting to multi-string format
   * This is a simple encoder; vendors may have specific requirements
   * @param {string} message - Plain or formatted text
   * @returns {string} Encoded multi-string
   */
  encodeMultiString(message) {
    // For now, pass through as-is
    // In production, implement MUTCD 7-bit ASCII encoding with formatting codes
    return message;
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

module.exports = NTCIPVMS1203Handler;
