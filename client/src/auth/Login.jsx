// client/src/auth/Login.jsx
import React, { useState } from 'react';
import { KeyRound, Github, X } from 'lucide-react';
import { apiPost } from '../lib/api';
import { setToken } from '../lib/auth';

export default function Login({ onLoggedIn }) {
  const [consent, setConsent] = useState({ open: false, provider: null, loading: false, error: '' });
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
                    <button type="button" className="text-sm text-blue-700 hover:underline" onClick={async () => { try { await apiPost('/auth/forgot', { email: email || 'demo@unicon.local' }); alert('If the account exists, a reset link was sent (demo).'); } catch (e) { alert(e.message || 'Request failed'); } }}>Forgot password</button>
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
                </div>
                <div className="pt-2">
                  <label className="text-[16px] leading-6 font-semibold text-gray-700">Language</label>
                  <select className="w-full border rounded px-3 py-2 h-10" defaultValue="en" onChange={async (e) => { const lang = e.target.value; try { await import('../lib/api').then(m => m.apiPost('/settings/language', { lang })).catch(()=>{}); } catch(_) {}; try { localStorage.setItem('lang', lang); } catch(_) {} }}>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
                <div className="text-xs text-gray-500 pt-6 flex items-center gap-2">
                  <a className="hover:underline" href="#">Imprint</a>
                  <span>•</span>
                  <a className="hover:underline" href="#">Privacy Policy</a>
                  <span>•</span>
                  <a className="hover:underline" href="#">Server Details</a>
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
    </div>
  );
}
