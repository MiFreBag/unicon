// client/src/layout/Header.jsx
import React from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { apiGet } from '../lib/api';
import { clearAuth, getToken } from '../lib/auth';
import ConnectionBadge from '../ui/ConnectionBadge.jsx';

export default function Header({ onNewConnection, activeTab }) {
  const [me, setMe] = React.useState(null);
  React.useEffect(() => {
    const t = getToken();
    if (!t) return; // skip in dev bypass/no auth
    apiGet('/me').then(d => setMe(d.user)).catch(()=>{});
  }, []);

  // Derive active connection for global header badge
  const [activeConnection, setActiveConnection] = React.useState(null);
  React.useEffect(() => {
    const params = activeTab?.params || {};
    // If a full connection object was provided in tab params
    if (params.connection && typeof params.connection === 'object') {
      setActiveConnection(params.connection);
      return;
    }
    // If we have a connectionId, look it up
    if (params.connectionId) {
      let mounted = true;
      apiGet('/connections').then(d => {
        const list = d.connections || [];
        const found = list.find(c => c.id === params.connectionId) || null;
        if (mounted) setActiveConnection(found);
      }).catch(()=> setActiveConnection(null));
      return () => { mounted = false; };
    }
    // Otherwise clear
    setActiveConnection(null);
  }, [activeTab?.id, activeTab?.params?.connectionId]);

  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    function onDocClick(e) {
      // close when clicking outside the menu/button area
      const menu = document.getElementById('account-menu');
      const btn = document.getElementById('account-menu-button');
      if (!menuOpen) return;
      if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpen]);

  return (
    <header className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/unicon/brand/swarco.svg" alt="Swarco" className="h-6" />
        <div className="font-semibold text-swarco-grey-900">Unicon</div>
      </div>
      <div className="flex items-center gap-3 relative">
        <ConnectionBadge connection={activeConnection || undefined} />
        <Button variant="secondary" size="md" leftEl={<Icon name="plus" size={16} className="mr-2"/>} onClick={onNewConnection}>New Connection</Button>
        <Tooltip text="Help">
          <button className="p-2 text-swarco-grey-800 hover:text-swarco-grey-900" aria-label="Help">
            <Icon name="circle-question" size={18} />
          </button>
        </Tooltip>
        <div className="flex items-center gap-2">
          {me?.avatar ? (
            <img src={me.avatar} alt="avatar" className="h-8 w-8 rounded-full border" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
              {me?.email ? me.email[0]?.toUpperCase() : '?'}
            </div>
          )}
          <div className="relative">
            <button id="account-menu-button" className="p-2 text-swarco-grey-800 hover:text-swarco-grey-900" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="account-menu" onClick={() => setMenuOpen(v=>!v)}>
              <Icon name="chevron-down" size={16} />
            </button>
            {menuOpen && (
              <div id="account-menu" role="menu" className="absolute right-0 mt-2 w-56 bg-white border rounded shadow">
                <div className="px-3 py-2 text-sm text-gray-700 border-b">{me?.email || 'Signed in'}</div>
                <div className="px-3 py-2 text-xs text-gray-500">Provider: {me?.provider || '—'}</div>
                {me?.provider && (
                  <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={async ()=>{
                    try {
                      const token = localStorage.getItem('unicon_token_v1');
                      await fetch(`/unicon/api/auth/oauth/${me.provider}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
                      location.reload();
                    } catch(_){}
                  }}>
                    Disconnect {me.provider}
                  </button>
                )}
                <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={async ()=>{ const v = prompt('Language code (en/de):', 'en'); if(!v) return; try { await fetch('/unicon/api/settings/language', { method:'POST', headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('unicon_token_v1')?{ 'Authorization': `Bearer ${localStorage.getItem('unicon_token_v1')}` }: {}) }, body: JSON.stringify({ lang: v }) }); } catch (_){ } }}>
                  Language…
                </button>
                <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { clearAuth(); location.replace('/unicon/'); }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
