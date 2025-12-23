// client/src/auth/OAuthCallback.jsx
import React, { useEffect } from 'react'
import { setToken } from '../lib/auth'
import { apiPost } from '../lib/api'

export default function OAuthCallback() {
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search)
      const code = params.get('code')
      const state = params.get('state') // not used in demo
      try {
        const r = await apiPost('/oauth/token', { code, client_id: 'demo' })
        if (r?.access_token) {
          setToken(r.access_token, ['developer'])
          location.replace('/unicon/')
        }
      } catch (e) {
        alert(e.message || 'OAuth failed')
      }
    })()
  }, [])
  return <div className="p-6 text-sm text-gray-600">Completing sign-in…</div>
}