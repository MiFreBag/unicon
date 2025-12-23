// client/src/layout/TabStrip.jsx
import React from 'react';
import { X, XOctagon } from 'lucide-react';

export default function TabStrip({ tabs, activeTabId, onActivate, onClose, onCloseAll }) {
  return (
    <div className="h-10 border-b border-gray-200 bg-white px-2 flex items-end">
      {/* Scrollable tabs */}
      <div className="flex gap-1 overflow-x-auto flex-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onActivate(tab.id)}
            className={`group h-8 px-3 inline-flex items-center gap-2 rounded-t-md border border-b-0 ${
              tab.id === activeTabId
                ? 'bg-white border-gray-200 text-swarco-blue-800 border-b-swarco-blue-800'
                : 'bg-gray-100 text-swarco-grey-600 border-gray-200 hover:bg-gray-200'
            }`}
            title={tab.title}
          >
            <span className="text-sm whitespace-nowrap">{tab.title}</span>
            <span className="opacity-50 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}>
              <X size={14} />
            </span>
          </button>
        ))}
      </div>
      {/* Close all tabs button */}
      {tabs.length > 0 && (
        <button
          className="ml-2 h-8 w-8 flex items-center justify-center rounded border border-gray-200 text-swarco-grey-700 hover:bg-gray-100"
          title="Close all tabs"
          aria-label="Close all tabs"
          onClick={() => onCloseAll && onCloseAll()}
        >
          <XOctagon size={16} />
        </button>
      )}
    </div>
  );
}
