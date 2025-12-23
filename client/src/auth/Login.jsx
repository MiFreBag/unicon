// client/src/auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { KeyRound, Github, X } from 'lucide-react';
import { apiPost } from '../lib/api';
import { setToken } from '../lib/auth';
import Modal from '../ui/Modal.jsx';

export default function Login({ onLoggedIn }) {
  const [consent, setConsent] = useState({ open: false, provider: null, loading: false, error: '' });
  const [info, setInfo] = useState({ open: false, kind: null, data: null, loading: false, error: '' });
  async function startProvider(p) {
    setConsent({ open: true, provider: p, loading: false, error: '' });
  }
  async function continueProvider() {
    setConsent(c => ({ ...c, loading: true, error: '' }));
    try {
      const res = await fetch(`/unicon/api/oauth/${consent.provider}/init`);
      const data = await res.json();
      if (!res.ok || !data?.continue_url) throw new Error(data?.error || 'Init failed');
      location.href = data.continue_url;
    } catch (e) {
      setConsent(c => ({ ...c, loading: false, error: e.message || 'Init failed' }));
    }
  }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Lazy-load server details when the modal opens
  useEffect(() => {
    if (info.open && info.kind === 'server' && !info.loading && !info.data && !info.error) {
      setInfo(i => ({ ...i, loading: true }));
      fetch('/unicon/api/health')
        .then(r => r.json().catch(() => ({})).then(d => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (!ok) throw new Error(d?.error || 'Failed to load server details');
          setInfo(i => ({ ...i, data: d, loading: false }));
        })
        .catch(e => setInfo(i => ({ ...i, error: e.message || 'Failed to load server details', loading: false })));
    }
  }, [info.open, info.kind]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const out = await apiPost('/auth/login', { email, password });
      setToken(out.token, out.roles || []);
      onLoggedIn?.();
    } catch (e) {
      setError(e.message || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: login panel (50% width) */}
      <div className="w-full md:w-1/2 flex flex-col">
        {/* Logo area */}
        <div className="px-16 pt-12">
          <img src="/unicon/brand/swarco.svg" alt="SWARCO" className="h-12"/>
        </div>
        {/* Form area */}
        <div className="flex-1 flex items-center">
          <div className="w-full px-16">
            <div className="max-w-md">
              <h1 className="text-[32px] leading-[40px] font-bold mb-6">Welcome</h1>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Demo helper */}
                <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded p-3">
                  Demo credentials: <span className="font-semibold">demo@unicon.local</span> / <span className="font-semibold">demo123</span> 
                  <button type="button" className="ml-2 underline" onClick={() => { setEmail('demo@unicon.local'); setPassword('demo123'); }}>Use</button>
                </div>
                {error && <div className="text-red-600 text-sm">{error}</div>}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[16px] leading-6 font-semibold text-gray-700">Email</label>
                    <span className="text-[12px] text-gray-400">*</span>
                  </div>
                  <input type="email" className="w-full border rounded px-3 py-2 h-10" value={email} onChange={e=>setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[16px] leading-6 font-semibold text-gray-700">Password</label>
                    <button type="button" className="text-sm text-blue-700 hover:underline" onClick={async () => { try { const r = await apiPost('/auth/forgot', { email: email || 'demo@unicon.local' }); if (r?.reset_url) { alert(`Reset link (demo): ${r.reset_url}`); } else { alert('If the account exists, a reset link was sent.'); } } catch (e) { alert(e.message || 'Request failed'); } }}>Forgot password</button>
                  </div>
                  <input type="password" className="w-full border rounded px-3 py-2 h-10" value={password} onChange={e=>setPassword(e.target.value)} required />
                </div>
                <div className="flex items-center gap-4 pt-2">
                  {/* Demo OAuth (local) */}
                  <button type="button" aria-label="Continue with Demo OAuth" title="Continue with Demo OAuth" className="h-10 w-10 border rounded flex items-center justify-center" onClick={() => {
                    const redirect = `${location.origin}/unicon/auth/callback`;
                    const state = Math.random().toString(36).slice(2);
                    const url = `/unicon/api/oauth/authorize?client_id=demo&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`;
                    location.href = url;
                  }}>
                    <KeyRound size={18} aria-hidden="true" />
                  </button>
                  {/* Google */}
                  <button type="button" aria-label="Sign in with Google" title="Sign in with Google" className="h-10 w-10 border rounded flex items-center justify-center" onClick={() => startProvider('google')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#EA4335" d="M12 11.9999v3.8h5.3c-.2 1.2-1.4 3.5-5.3 3.5-3.2 0-5.9-2.6-5.9-5.9s2.7-5.9 5.9-5.9c1.8 0 3 .7 3.7 1.3l2.5-2.4C16.7 4.2 14.6 3.3 12 3.3 6.9 3.3 2.8 7.4 2.8 12.5S6.9 21.7 12 21.7c6.9 0 9.5-4.8 9.5-7.2 0-.5-.1-.8-.1-1.1H12z"/>
                    </svg>
                  </button>
                  {/* GitHub */}
                  <button type="button" aria-label="Sign in with GitHub" title="Sign in with GitHub" className="h-10 w-10 border rounded flex items-center justify-center" onClick={() => startProvider('github')}>
                    <Github size={18} aria-hidden="true" />
                  </button>
                  <button type="submit" disabled={loading} className="w-48 h-10 bg-[#004b8d] text-white rounded hover:bg-[#003a6c] disabled:opacity-50">
                    {loading ? 'Signing in…' : 'Login'}
                  </button>
                  <button type="button" className="text-sm text-blue-700 hover:underline" onClick={async () => {
                    try {
                      await apiPost('/auth/register', { email: email || 'demo@unicon.local', password: password || 'demo123' });
                      alert('Account created. Now you can sign in.');
                    } catch (e) {
                      alert(e.message || 'Sign up failed');
                    }
                  }}>Sign up</button>
                  {import.meta.env.DEV && (
                    <button type="button" className="text-sm text-gray-600 hover:underline" onClick={() => {
                      try {
                        // Dev bypass: set a dummy token and roles, then continue
                        setToken('dev-bypass', ['developer']);
                      } catch (_) {}
                      onLoggedIn?.();
                    }}>Dev login (bypass)</button>
                  )}
                </div>
                <div className="pt-2">
                  <label className="text-[16px] leading-6 font-semibold text-gray-700">Language</label>
                  <select className="w-full border rounded px-3 py-2 h-10" defaultValue="en" onChange={async (e) => { const lang = e.target.value; try { await import('../lib/api').then(m => m.apiPost('/settings/language', { lang })).catch(()=>{}); } catch(_) {}; try { localStorage.setItem('lang', lang); } catch(_) {} }}>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
                <div className="text-xs text-gray-500 pt-6 flex items-center gap-2">
                  <a className="hover:underline" href="#" onClick={(e)=>{e.preventDefault(); setInfo({ open:true, kind:'imprint', data:null, loading:false, error:'' });}}>Imprint</a>
                  <span>•</span>
                  <a className="hover:underline" href="#" onClick={(e)=>{e.preventDefault(); setInfo({ open:true, kind:'privacy', data:null, loading:false, error:'' });}}>Privacy Policy</a>
                  <span>•</span>
                  <a className="hover:underline" href="#" onClick={(e)=>{e.preventDefault(); setInfo({ open:true, kind:'server', data:null, loading:false, error:'' });}}>Server Details</a>
                  <span className="ml-auto opacity-80">© {new Date().getFullYear()} SWARCO</span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Right: background image (50% width) */}
      <div className="hidden md:block md:w-1/2 relative">
        <img src="/unicon/brand/background-image.png" alt="Background" className="absolute inset-0 w-full h-full object-cover"/>
      </div>
      {/* Modal consent */}
      {consent.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-gray-900">Continue with {consent.provider}</div>
              <button className="p-1" aria-label="Close" onClick={()=>setConsent({ open:false, provider:null, loading:false, error:'' })}><X size={18}/></button>
            </div>
            <p className="text-sm text-gray-600 mb-3">You will be redirected to {consent.provider} to continue.</p>
            {consent.error && <div className="text-sm text-red-600 mb-2">{consent.error}</div>}
            <div className="flex gap-2">
              <button className="px-4 h-10 rounded bg-[#004b8d] text-white disabled:opacity-50" disabled={consent.loading} onClick={continueProvider}>{consent.loading ? 'Continuing…' : 'Continue'}</button>
              <button className="px-4 h-10 rounded bg-gray-100" onClick={()=>setConsent({ open:false, provider:null, loading:false, error:'' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Info modal: Imprint / Privacy Policy / Server Details */}
      <Modal
        open={info.open}
        title={info.kind === 'imprint' ? 'Imprint' : info.kind === 'privacy' ? 'Privacy Policy' : info.kind === 'server' ? 'Server Details' : ''}
        onClose={() => setInfo({ open:false, kind:null, data:null, loading:false, error:'' })}
        footer={
          <button className="px-4 h-10 rounded bg-gray-100" onClick={() => setInfo({ open:false, kind:null, data:null, loading:false, error:'' })}>Close</button>
        }
      >
        {info.kind === 'imprint' && (
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>Company:</strong> SWARCO</p>
            <p><strong>Address:</strong> [Add address]</p>
            <p><strong>Contact:</strong> [Add contact email/phone]</p>
            <p className="text-gray-500">This is placeholder text. Replace with your legal imprint details.</p>
          </div>
        )}
        {info.kind === 'privacy' && (
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>Privacy Policy</strong></p>
            <p>We process personal data for authentication and service provision. Replace this text with your actual policy or link to your public policy page.</p>
          </div>
        )}
        {info.kind === 'server' && (
          <div className="text-sm text-gray-700 space-y-2">
            {info.loading && <div>Loading…</div>}
            {info.error && <div className="text-red-600">{info.error}</div>}
            {info.data && (
              <div className="space-y-1">
                {'version' in info.data && <div><strong>Version:</strong> {String(info.data.version)}</div>}
                {'status' in info.data && <div><strong>Status:</strong> {String(info.data.status)}</div>}
                {'timestamp' in info.data && <div><strong>Timestamp:</strong> {String(info.data.timestamp)}</div>}
                {'uptime' in info.data && <div><strong>Uptime:</strong> {String(info.data.uptime)}</div>}
                {'connectedClients' in info.data && <div><strong>Connected Clients:</strong> {String(info.data.connectedClients)}</div>}
                {'activeConnections' in info.data && <div><strong>Active Connections:</strong> {String(info.data.activeConnections)}</div>}
                {info.data && typeof info.data === 'object' && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">Raw</summary>
                    <pre className="bg-gray-50 p-2 rounded overflow-auto text-xs">{JSON.stringify(info.data, null, 2)}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
