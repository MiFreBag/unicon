import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';

export default function NtcipEssWorkspace({ connection, api }) {
  const [operation, setOperation] = useState('readSnapshot');
  const [oids, setOids] = useState(['1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0']);
  const [baseOid, setBaseOid] = useState('1.3.6.1.4.1.1206.4.2.3.3.3');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleReadSnapshot = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/operation', {
        connectionId: connection.id,
        operation: 'readSnapshot'
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
      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-cyan-900">NTCIP 1204 ESS (Environmental Sensor Station)</h2>
        <p className="text-sm text-cyan-700 mt-2">
          {connection.name} @ {connection.config?.host || 'unknown'}:{connection.config?.port || 161}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Read Snapshot Section */}
      <div className="border rounded-lg p-4">
        <h3 className="text-md font-semibold mb-3">Environmental Snapshot</h3>
        <p className="text-sm text-gray-600 mb-4">
          Fetch current temperature, humidity, wind, precipitation, and visibility data.
        </p>
        <Button onClick={handleReadSnapshot} disabled={loading}>
          {loading ? 'Reading...' : 'Read Snapshot'}
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
            placeholder="1.3.6.1.4.1.1206.4.2.3.3.3.1.1.0"
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
            placeholder="1.3.6.1.4.1.1206.4.2.3.3.3"
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
