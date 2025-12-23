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
      <div className="flex items-center gap-3">
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
          <Tooltip text="Logout">
            <button className="p-2 text-swarco-grey-800 hover:text-swarco-grey-900" onClick={() => { clearAuth(); location.replace('/unicon/'); }}>
              <Icon name="arrow-right-from-bracket" size={18} />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
