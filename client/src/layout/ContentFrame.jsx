// client/src/layout/ContentFrame.jsx
import React, { useMemo } from 'react';

export default function ContentFrame({ tabs, activeTabId, registry, openTab }) {
  const active = useMemo(() => tabs.find(t => t.id === activeTabId) || null, [tabs, activeTabId]);
  if (!active) {
    return (
      <main className="flex-1 bg-white flex items-center justify-center text-gray-500">No tabs open</main>
    );
  }
  const def = registry[active.kind];
  if (!def) {
    return (
      <main className="flex-1 bg-white flex items-center justify-center text-gray-500">Unknown tab</main>
    );
  }
  const Component = def.component;
  return (
    <main className="flex-1 bg-white p-4 overflow-auto">
      <Component {...(active.params || {})} openTab={openTab} />
    </main>
  );
}
