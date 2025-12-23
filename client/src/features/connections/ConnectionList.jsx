// client/src/features/connections/ConnectionList.jsx
import React, { useEffect, useState } from 'react';
import { listConnections, createConnection, deleteConnection, connectConnection, disconnectConnection } from '../../lib/api';
import { Plus, Trash2, Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function ConnectionList() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listConnections();
      setConnections(res.connections || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function onCreate(payload) {
    await createConnection(payload);
    setShowDialog(false);
    await load();
  }

  async function onDelete(id) {
    await deleteConnection(id);
    await load();
  }

  async function onToggle(conn) {
    if (conn.status === 'connected') {
      await disconnectConnection(conn.id);
    } else {
      await connectConnection(conn.id);
    }
    await load();
  }

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Connections</h2>
        <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50" onClick={() => setShowDialog(true)}>
          <Plus size={16} /> New
        </button>
      </div>

      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Status</th>
              <th className="p-2 text-right">
                <button className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900" onClick={load} title="Refresh">
                  <RefreshCw size={14} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {connections.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.name}</td>
                <td className="p-2 uppercase text-xs text-gray-600">{c.type}</td>
                <td className="p-2">
                  <span className={`connection-status ${c.status}`}>{c.status}</span>
                </td>
                <td className="p-2 text-right">
                  <button className="inline-flex items-center gap-1 px-2 py-1 border rounded mr-2 hover:bg-gray-50" onClick={() => onToggle(c)}>
                    {c.status === 'connected' ? <><WifiOff size={14} /> Disconnect</> : <><Wifi size={14} /> Connect</>}
                  </button>
                  <button className="inline-flex items-center gap-1 px-2 py-1 border rounded text-red-600 hover:bg-red-50" onClick={() => onDelete(c.id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {connections.length === 0 && (
              <tr><td className="p-4 text-center text-gray-500" colSpan={4}>{loading ? 'Loading...' : 'No connections'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showDialog && <ConnectionDialog onClose={() => setShowDialog(false)} onSave={onCreate} />}
    </div>
  );
}

function ConnectionDialog({ onClose, onSave }) {
  const [name, setName] = useState('My REST');
  const [type, setType] = useState('rest');
  const [baseUrl, setBaseUrl] = useState('https://jsonplaceholder.typicode.com');
  // SSH fields
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState(22);
  const [sshUser, setSshUser] = useState('root');
  const [sshAuthType, setSshAuthType] = useState('password');
  const [sshPassword, setSshPassword] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [sshPassphrase, setSshPassphrase] = useState('');
  // K8s fields
  const [kubeSource, setKubeSource] = useState('default');
  const [kubePath, setKubePath] = useState('');
  const [kubeInline, setKubeInline] = useState('');
  const [kubeContext, setKubeContext] = useState('');
  const [kubeNamespace, setKubeNamespace] = useState('default');

  const onSubmit = () => {
    if (!name.trim()) return;
    let config = {};
    if (type === 'rest') {
      config = { baseUrl };
    } else if (type === 'ssh') {
      config = {
        host: sshHost, port: Number(sshPort), username: sshUser,
        ...(sshAuthType === 'password' ? { password: sshPassword } : { privateKey: sshPrivateKey, passphrase: sshPassphrase })
      };
    } else if (type === 'k8s') {
      const kubeconfig = kubeSource === 'inline' ? kubeInline : undefined;
      const kubeconfigPath = kubeSource === 'path' ? kubePath : undefined;
      config = { kubeconfigSource: kubeSource, kubeconfig, kubeconfigPath, context: kubeContext, namespace: kubeNamespace };
    }
    onSave({ name: name.trim(), type, config });
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-lg w-full max-w-md">
        <div className="p-4 border-b font-semibold">New Connection</div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input className="w-full border rounded px-3 py-2" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Type</label>
            <select className="w-full border rounded px-3 py-2" value={type} onChange={e => setType(e.target.value)}>
              <option value="rest">REST</option>
              <option value="opc-ua">OPC UA</option>
              <option value="ws">WebSocket</option>
              <option value="grpc">gRPC</option>
              <option value="cpd">CPD</option>
              <option value="sql">SQL</option>
            </select>
          </div>
          {type === 'rest' && (
            <div>
              <label className="block text-sm mb-1">Base URL</label>
              <input className="w-full border rounded px-3 py-2" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com" />
            </div>
          )}
          {type === 'ssh' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Host</label>
                  <input className="w-full border rounded px-3 py-2" value={sshHost} onChange={e => setSshHost(e.target.value)} placeholder="server.example.com" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Port</label>
                  <input type="number" className="w-full border rounded px-3 py-2" value={sshPort} onChange={e => setSshPort(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Username</label>
                  <input className="w-full border rounded px-3 py-2" value={sshUser} onChange={e => setSshUser(e.target.value)} placeholder="root" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Auth Type</label>
                  <select className="w-full border rounded px-3 py-2" value={sshAuthType} onChange={e => setSshAuthType(e.target.value)}>
                    <option value="password">Password</option>
                    <option value="privateKey">Private Key</option>
                  </select>
                </div>
              </div>
              {sshAuthType === 'password' ? (
                <div>
                  <label className="block text-sm mb-1">Password</label>
                  <input type="password" className="w-full border rounded px-3 py-2" value={sshPassword} onChange={e => setSshPassword(e.target.value)} />
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm mb-1">Private Key (PEM)</label>
                    <textarea className="w-full border rounded px-3 py-2 font-mono text-xs" rows={5} value={sshPrivateKey} onChange={e => setSshPrivateKey(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Passphrase (optional)</label>
                    <input type="password" className="w-full border rounded px-3 py-2" value={sshPassphrase} onChange={e => setSshPassphrase(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          )}
          {type === 'k8s' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Kubeconfig Source</label>
                <select className="w-full border rounded px-3 py-2" value={kubeSource} onChange={e => setKubeSource(e.target.value)}>
                  <option value="default">Default</option>
                  <option value="path">Path</option>
                  <option value="inline">Inline</option>
                </select>
              </div>
              {kubeSource === 'path' && (
                <div>
                  <label className="block text-sm mb-1">Kubeconfig Path</label>
                  <input className="w-full border rounded px-3 py-2" value={kubePath} onChange={e => setKubePath(e.target.value)} placeholder="C:/Users/me/.kube/config" />
                </div>
              )}
              {kubeSource === 'inline' && (
                <div>
                  <label className="block text-sm mb-1">Kubeconfig (YAML)</label>
                  <textarea className="w-full border rounded px-3 py-2 font-mono text-xs" rows={6} value={kubeInline} onChange={e => setKubeInline(e.target.value)} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Context (optional)</label>
                  <input className="w-full border rounded px-3 py-2" value={kubeContext} onChange={e => setKubeContext(e.target.value)} placeholder="my-context" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Default Namespace</label>
                  <input className="w-full border rounded px-3 py-2" value={kubeNamespace} onChange={e => setKubeNamespace(e.target.value)} placeholder="default" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button className="px-3 py-1.5 border rounded" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1.5 border rounded bg-blue-600 text-white" onClick={onSubmit}>Create</button>
        </div>
      </div>
    </div>
  );
}
