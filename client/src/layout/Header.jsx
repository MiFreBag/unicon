// client/src/layout/Header.jsx
import React from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { apiGet, listWorkspaces, createWorkspace } from '../lib/api';
import WorkspaceManager from '../features/workspaces/WorkspaceManager.jsx';
import { clearAuth, getToken } from '../lib/auth';
import ConnectionBadge from '../ui/ConnectionBadge.jsx';

export default function Header({ onNewConnection, activeTab }) {
  const [me, setMe] = React.useState(null);
  React.useEffect(() => {
    const t = getToken();
    if (!t) return; // skip in dev bypass/no auth
    apiGet('/me').then(d => setMe(d.user)).catch(()=>{});
  }, []);

  // Workspaces (team)
  const [workspaces, setWorkspaces] = React.useState([]);
  const [activeWs, setActiveWs] = React.useState(() => { try { return localStorage.getItem('unicon_current_workspace_v1') || ''; } catch { return ''; } });
  React.useEffect(() => {
    let mounted = true;
    listWorkspaces().then(d => { if (mounted) setWorkspaces(d.workspaces || []); }).catch(()=>{});
    return () => { mounted = false; };
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

  const [wsMgr, setWsMgr] = React.useState(false);
  return (
    <>
    <header className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/unicon/brand/swarco.svg" alt="Swarco" className="h-6" />
        <div className="font-semibold text-swarco-grey-900">Unicon</div>
      </div>
      <div className="flex items-center gap-3 relative">
        <div className="flex items-center gap-2">
          <select className="border rounded px-2 py-1 text-sm" value={activeWs} onChange={e=>{ const v=e.target.value; setActiveWs(v); try { localStorage.setItem('unicon_current_workspace_v1', v); } catch {} location.reload(); }}>
            <option value="">All workspaces</option>
            {workspaces.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
          </select>
          <button className="px-2 py-1 border rounded text-xs" title="Create workspace" onClick={async ()=>{ const name = prompt('New workspace name'); if(!name) return; try { const r = await createWorkspace(name); setWorkspaces(prev => [...prev, r.workspace]); localStorage.setItem('unicon_current_workspace_v1', r.workspace.id); location.reload(); } catch(e){ alert('Failed: '+e.message); } }}>
            +
          </button>
        </div>
        <button className="px-2 py-1 border rounded text-xs" title="Manage workspaces" onClick={()=>setWsMgr(true)}>Manage</button>
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
    <WorkspaceManager open={wsMgr} onClose={()=>{ setWsMgr(false); /* reload list on close */ listWorkspaces().then(d=>setWorkspaces(d.workspaces||[])).catch(()=>{}); }} />
    </>
  );
}
