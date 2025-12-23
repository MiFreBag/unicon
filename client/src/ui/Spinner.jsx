// client/src/ui/Spinner.jsx
import React from 'react';

export default function Spinner({ size=16 }) {
  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg style={{ width: dim, height: dim }} className="animate-spin text-swarco-blue-800" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}