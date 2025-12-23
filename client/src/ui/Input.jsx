// client/src/ui/Input.jsx
import React from 'react';

export function FieldLabel({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block text-[16px] leading-6 font-semibold text-swarco-grey-900 mb-1">
      {children}
    </label>
  );
}

export function HelperText({ children, tone = 'default' }) {
  const cls = tone === 'error' ? 'text-swarco-red-500' : 'text-swarco-grey-600';
  return <div className={`mt-1 text-[12px] leading-4 ${cls}`}>{children}</div>;
}

export default function Input({ id, label, error, helper, className = '', ...props }) {
  return (
    <div className={className}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <input
        id={id}
        className={`h-10 w-full rounded-[4px] border px-3 text-[16px] leading-6 placeholder-swarco-grey-400 focus:outline-none focus:ring-2 focus:ring-swarco-blue-200 focus:border-swarco-blue-600
          ${error ? 'border-swarco-red-500' : 'border-swarco-grey-400'}`}
        {...props}
      />
      {helper ? <HelperText tone={error ? 'error' : 'default'}>{helper}</HelperText> : null}
    </div>
  );
}