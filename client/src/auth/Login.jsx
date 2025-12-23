// client/src/auth/Login.jsx
import React, { useState } from 'react';
import { apiPost } from '../lib/api';
import { setToken } from '../lib/auth';

export default function Login({ onLoggedIn }) {
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
                    <label className="text-[16px] leading-6 font-semibold text-gray-700">Username</label>
                    <span className="text-[12px] text-gray-400">*</span>
                  </div>
                  <label className="text-[16px] leading-6 font-semibold text-gray-700">Username</label>
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
                  <button type="button" className="h-10 px-4 border rounded text-sm" onClick={() => {
                    const redirect = `${location.origin}/unicon/auth/callback`;
                    const state = Math.random().toString(36).slice(2);
                    const url = `/unicon/api/oauth/authorize?client_id=demo&redirect_uri=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`;
                    location.href = url;
>Continue with OAuth (Demo)</button>
                  <button type="button" className="h-10 px-4 border rounded text-sm" onClick={() => { location.href = '/unicon/api/oauth/google/start'; }}>Sign in with Google</button>
                  <button type="button" className="h-10 px-4 border rounded text-sm" onClick={() => { location.href = '/unicon/api/oauth/github/start'; }}>Sign in with GitHub</button>
                  <button disabled={loading} className="w-48 h-10 bg-[#004b8d] text-white rounded hover:bg-[#003a6c] disabled:opacity-50">
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
    </div>
  );
}