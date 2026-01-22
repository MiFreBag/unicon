import React from 'react';

export default function SingleValueCard({ title = 'Metric', value, unit, subtitle }) {
  return (
    <div className="border rounded-md bg-white p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">
        {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
        {unit ? ` (${unit})` : ''}
      </div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}