// client/src/ui/Checkbox.jsx
import React from 'react';
import { HelperText } from './Input.jsx';

export default function Checkbox({ id, label, helper, error, className = '', ...props }) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className={`h-4 w-4 rounded border ${error ? 'border-swarco-red-500' : 'border-swarco-grey-400'} text-swarco-blue-800 focus:ring-swarco-blue-200`}
        {...props}
      />
      <div>
        {label ? (
          <label htmlFor={id} className="text-[16px] leading-6 text-swarco-grey-900">
            {label}
          </label>
        ) : null}
        {helper ? <HelperText tone={error ? 'error' : 'default'}>{helper}</HelperText> : null}
      </div>
    </div>
  );
}