// client/src/layout/Header.jsx
import React from 'react';
import { Plus, HelpCircle } from 'lucide-react';
import Button from '../ui/Button.jsx';

export default function Header({ onNewConnection }) {
  return (
    <header className="h-14 border-b border-gray-200 bg-white px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src="/brand/swarco_blue.svg" alt="Swarco" className="h-6" />
        <div className="font-semibold text-swarco-grey-900">Unicon</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="md" leftIcon={Plus} onClick={onNewConnection}>New Connection</Button>
        <button className="p-2 text-swarco-grey-800 hover:text-swarco-grey-900" aria-label="Help">
          <HelpCircle size={18} />
        </button>
      </div>
    </header>
  );
}
