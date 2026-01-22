import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';

export default function NtcipVmsWorkspace({ connection, api }) {
  const [messageText, setMessageText] = useState('ROAD WORK AHEAD');
  const [messageNumber, setMessageNumber] = useState(1);
  const [beacon, setBeacon] = useState(0);
  const [oids, setOids] = useState(['1.3.6.1.4.1.1206.4.2.3.5.3.1.0']);
  const [baseOid, setBaseOid] = useState('1.3.6.1.4.1.1206.4.2.3.5.4.1');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGetStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/operation', {
        connectionId: connection.id,
        operation: 'getStatus'
      });
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetMessage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/operation', {
        connectionId: connection.id,
        operation: 'setMessage',
        params: {
          messageText,
          messageNumber: parseInt(messageNumber, 10),
          beacon: parseInt(beacon, 10)
        }
      });
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/operation', {
        connectionId: connection.id,
        operation: 'get',
        params: { oids: oids.filter(o => o.trim()) }
      });
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetTable = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/operation', {
        connectionId: connection.id,
        operation: 'getTable',
        params: { baseOid }
      });
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-orange-900">NTCIP 1203 VMS (Variable Message Sign)</h2>
        <p className="text-sm text-orange-700 mt-2">
          {connection.name} @ {connection.config?.host || 'unknown'}:{connection.config?.port || 161}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Get Status Section */}
      <div className="border rounded-lg p-4">
        <h3 className="text-md font-semibold mb-3">Device Status</h3>
        <p className="text-sm text-gray-600 mb-4">
          Fetch current VMS status, message number, brightness, and error flags.
        </p>
        <Button onClick={handleGetStatus} disabled={loading}>
          {loading ? 'Fetching...' : 'Get Status'}
        </Button>
      </div>

      {/* Set Message Section */}
      <div className="border rounded-lg p-4">
        <h3 className="text-md font-semibold mb-3">Set Message</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Message Text</label>
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="ROAD WORK AHEAD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Message Number</label>
            <Input
              type="number"
              value={messageNumber}
              onChange={(e) => setMessageNumber(e.target.value)}
              min={1}
              max={16}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={beacon === 1}
              onChange={(e) => setBeacon(e.target.checked ? 1 : 0)}
              className="rounded"
            />
            <span className="text-sm font-medium">Enable Beacon</span>
          </label>
        </div>
        <Button onClick={handleSetMessage} disabled={loading} className="bg-orange-600 hover:bg-orange-700">
          {loading ? 'Setting...' : 'Set Message'}
        </Button>
      </div>

      {/* Get OIDs Section */}
      <div className="border rounded-lg p-4">
        <h3 className="text-md font-semibold mb-3">Get OID Values</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">OID List (one per line)</label>
          <textarea
            className="w-full p-2 border rounded text-sm font-mono"
            rows={4}
            value={oids.join('\n')}
            onChange={(e) => setOids(e.target.value.split('\n'))}
            placeholder="1.3.6.1.4.1.1206.4.2.3.5.3.1.0"
          />
        </div>
        <Button onClick={handleGet} disabled={loading}>
          {loading ? 'Fetching...' : 'Get Values'}
        </Button>
      </div>

      {/* Get Table Section */}
      <div className="border rounded-lg p-4">
        <h3 className="text-md font-semibold mb-3">Walk SNMP Table</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Base OID</label>
          <Input
            value={baseOid}
            onChange={(e) => setBaseOid(e.target.value)}
            placeholder="1.3.6.1.4.1.1206.4.2.3.5.4.1"
          />
        </div>
        <Button onClick={handleGetTable} disabled={loading}>
          {loading ? 'Walking...' : 'Walk Table'}
        </Button>
      </div>

      {/* Results Section */}
      {result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="text-md font-semibold mb-3">Result</h3>
          <pre className="bg-white p-3 rounded text-sm overflow-auto border font-mono max-h-96">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
