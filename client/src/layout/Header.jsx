// client/src/layout/Header.jsx
import React from 'react';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { apiGet } from '../lib/api';
import { clearAuth } from '../lib/auth';

export default function Header({ onNewConnection }) {
  const [me, setMe] = React.useState(null);
  React.useEffect(() => {
    apiGet('/me').then(d => setMe(d.user)).catch(()=>{});
  }, []);
  return (
    <header className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/unicon/brand/swarco.svg" alt="Swarco" className="h-6" />
        <div className="font-semibold text-swarco-grey-900">Unicon</div>
      </div>
      <div className="flex items-center gap-3 relative">
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
          <div className="group relative">
            <button className="p-2 text-swarco-grey-800 hover:text-swarco-grey-900" aria-haspopup="menu">
              <Icon name="chevron-down" size={16} />
            </button>
            <div className="hidden group-hover:block absolute right-0 mt-2 w-56 bg-white border rounded shadow">
              <div className="px-3 py-2 text-sm text-gray-700 border-b">{me?.email || 'Signed in'}</div>
              <div className="px-3 py-2 text-xs text-gray-500">Provider: {me?.provider || '—'}</div>
              {me?.provider && (
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={async ()=>{
                  try {
                    const token = localStorage.getItem('unicon_token_v1');
                    await fetch(`/unicon/api/auth/oauth/${me.provider}`, { method: 'DELETE', headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
                    location.reload();
                  } catch(_){}
                }}>
                  Disconnect {me.provider}
                </button>
              )}
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={async ()=>{ const v = prompt('Language code (en/de):', 'en'); if(!v) return; try { await fetch('/unicon/api/settings/language', { method:'POST', headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('unicon_token_v1')?{ 'Authorization': `Bearer ${localStorage.getItem('unicon_token_v1')}` }: {}) }, body: JSON.stringify({ lang: v }) }); } catch (_){ } }}>
                Language…
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { clearAuth(); location.replace('/unicon/'); }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
