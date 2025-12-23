// client/src/ui/Tooltip.jsx
import React from 'react';

export default function Tooltip({ text, children }) {
  return (
    <span className="relative group inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-swarco-grey-900 text-white text-[12px] leading-4 px-2 py-1 rounded">
        {text}
      </span>
    </span>
  );
}