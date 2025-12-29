import React, { useState } from 'react';
import { apiPost } from '../../lib/api';

export default function NetworkTools() {
  const [host, setHost] = useState('8.8.8.8');
  const [count, setCount] = useState(4);
  const [pingOut, setPingOut] = useState('');
  const [traceOut, setTraceOut] = useState('');
  const [dnsName, setDnsName] = useState('example.com');
  const [dnsType, setDnsType] = useState('A');
  const [dnsOut, setDnsOut] = useState('');

  const [ip, setIp] = useState('192.168.1.10');
  const [cidr, setCidr] = useState(24);
  const [calc, setCalc] = useState(null);

  async function doPing() {
    setPingOut('Running...');
    try {
      const r = await apiPost('/tools/ping', { host, count: Number(count) || 4, timeoutMs: 12000 });
      setPingOut(r.output || JSON.stringify(r));
    } catch (e) { setPingOut(String(e.message)); }
  }
  async function doTrace() {
    setTraceOut('Running...');
    try {
      const r = await apiPost('/tools/traceroute', { host, maxHops: 20, timeoutMs: 20000 });
      setTraceOut(r.output || JSON.stringify(r));
    } catch (e) { setTraceOut(String(e.message)); }
  }

  async function doDns() {
    setDnsOut('Running...');
    try {
      const r = await apiPost('/tools/dns', { name: dnsName, rrtype: dnsType });
      setDnsOut(JSON.stringify(r, null, 2));
    } catch (e) { setDnsOut(String(e.message)); }
  }

  function calcIp() {
    try {
      const res = ipv4Calc(ip, Number(cidr)||24);
      setCalc(res);
    } catch (e) { setCalc({ error: String(e.message) }); }
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-medium">Network Tools</h3>
      <div className="grid grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-sm mb-1">Host/IP</label>
          <input className="w-full border rounded px-2 py-1" value={host} onChange={e=>setHost(e.target.value)} placeholder="8.8.8.8" />
        </div>
        <div>
          <label className="block text-sm mb-1">Ping count</label>
          <input className="w-full border rounded px-2 py-1" type="number" value={count} onChange={e=>setCount(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 border rounded" onClick={doPing}>Ping</button>
          <button className="px-3 py-1.5 border rounded" onClick={doTrace}>Traceroute</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <pre className="border rounded p-2 text-xs bg-gray-50 whitespace-pre-wrap">{pingOut}</pre>
        <pre className="border rounded p-2 text-xs bg-gray-50 whitespace-pre-wrap">{traceOut}</pre>
        <div>
          <div className="flex items-end gap-2 mb-2">
            <div className="flex-1">
              <label className="block text-sm mb-1">DNS name</label>
              <input className="w-full border rounded px-2 py-1" value={dnsName} onChange={e=>setDnsName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm mb-1">Type</label>
              <select className="border rounded px-2 py-1" value={dnsType} onChange={e=>setDnsType(e.target.value)}>
                {['A','AAAA','CNAME','TXT','MX','NS','SRV'].map(t=> <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button className="px-3 py-1.5 border rounded" onClick={doDns}>DNS</button>
          </div>
          <pre className="border rounded p-2 text-xs bg-gray-50 whitespace-pre-wrap h-40 overflow-auto">{dnsOut}</pre>
        </div>
      </div>

      <HttpEcho />

      <div className="pt-2 border-t" />
      <h4 className="font-medium">IPv4 Calculator</h4>
      <div className="grid grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-sm mb-1">IP</label>
          <input className="w-full border rounded px-2 py-1" value={ip} onChange={e=>setIp(e.target.value)} placeholder="192.168.1.10" />
        </div>
        <div>
          <label className="block text-sm mb-1">CIDR</label>
          <input className="w-full border rounded px-2 py-1" type="number" value={cidr} onChange={e=>setCidr(e.target.value)} />
        </div>
        <div>
          <button className="px-3 py-1.5 border rounded" onClick={calcIp}>Calculate</button>
        </div>
      </div>
      {calc && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="border rounded p-2"><div className="text-xs text-gray-500">Network</div><div className="font-mono">{calc.network}</div></div>
          <div className="border rounded p-2"><div className="text-xs text-gray-500">Broadcast</div><div className="font-mono">{calc.broadcast}</div></div>
          <div className="border rounded p-2"><div className="text-xs text-gray-500">Mask</div><div className="font-mono">{calc.mask}</div></div>
          <div className="border rounded p-2 col-span-3"><div className="text-xs text-gray-500">Host Range</div><div className="font-mono">{calc.firstHost} – {calc.lastHost} ({calc.hosts} hosts)</div></div>
        </div>
      )}
    </div>
  );
}

function HttpEcho() {
  const [method, setMethod] = React.useState('GET');
  const [payload, setPayload] = React.useState('{"ping":"pong"}');
  const [out, setOut] = React.useState('');
  async function run() {
    try {
      const body = method === 'GET' ? {} : JSON.parse(payload || '{}');
      const res = await apiPost('/tools/http-echo', body);
      setOut(JSON.stringify(res, null, 2));
    } catch (e) { setOut(String(e.message)); }
  }
  return (
    <div className="pt-4">
      <h4 className="font-medium">HTTP Echo</h4>
      <div className="flex items-end gap-2 mb-2">
        <div>
          <label className="block text-sm mb-1">Method</label>
          <select className="border rounded px-2 py-1" value={method} onChange={e=>setMethod(e.target.value)}>
            {['GET','POST','PUT','PATCH','DELETE'].map(m=> <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {method!=='GET' && (
          <div className="flex-1">
            <label className="block text-sm mb-1">Body (JSON)</label>
            <textarea className="w-full border rounded p-2 font-mono text-xs" rows={4} value={payload} onChange={e=>setPayload(e.target.value)} />
          </div>
        )}
        <button className="px-3 py-1.5 border rounded" onClick={run}>Send</button>
      </div>
      <pre className="border rounded p-2 text-xs bg-gray-50 whitespace-pre-wrap h-48 overflow-auto">{out}</pre>
    </div>
  );
}

function ipv4Calc(ip, cidr) {
  const oct = ip.split('.').map(x=>parseInt(x,10));
  if (oct.length!==4 || oct.some(x=>!(x>=0&&x<=255))) throw new Error('Invalid IPv4');
  if (!(cidr>=0&&cidr<=32)) throw new Error('Invalid CIDR');
  const ipn = (oct[0]<<24)|(oct[1]<<16)|(oct[2]<<8)|oct[3];
  const mask = cidr===0?0: (~0 << (32-cidr)) >>> 0;
  const network = (ipn & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const toStr = (n)=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');
  const hosts = cidr===32?1: Math.max(0,(broadcast-network-1));
  const firstHost = cidr>=31? toStr(network): toStr(network+1);
  const lastHost = cidr>=31? toStr(broadcast): toStr(broadcast-1);
  return { network: toStr(network), broadcast: toStr(broadcast), mask: toStr(mask), firstHost, lastHost, hosts };
}