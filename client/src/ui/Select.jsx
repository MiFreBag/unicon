// client/src/ui/Select.jsx
import React from 'react';
import { FieldLabel, HelperText } from './Input.jsx';

export default function Select({ id, label, error, helper, className = '', children, ...props }) {
  return (
    <div className={className}>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <select
        id={id}
        className={`h-10 w-full rounded-[4px] border px-3 text-[16px] leading-6 focus:outline-none focus:ring-2 focus:ring-swarco-blue-200 focus:border-swarco-blue-600
          ${error ? 'border-swarco-red-500' : 'border-swarco-grey-400'}`}
        {...props}
      >
        {children}
      </select>
      {helper ? <HelperText tone={error ? 'error' : 'default'}>{helper}</HelperText> : null}
    </div>
  );
}