// client/src/ui/Alert.jsx
import React from 'react';

const variants = {
  info: 'bg-swarco-blue-100 text-swarco-blue-900 border-swarco-blue-200',
  success: 'bg-swarco-green-200 text-swarco-green-800 border-swarco-green-200',
  warning: 'bg-swarco-yellow-200 text-swarco-grey-900 border-swarco-yellow-200',
  error: 'bg-swarco-red-200 text-swarco-red-800 border-swarco-red-200',
  critical: 'bg-swarco-red-200 text-swarco-red-800 border-swarco-red-200',
};

export default function Alert({ variant='info', title, children }) {
  return (
    <div className={`border rounded p-3 text-sm ${variants[variant]}`}>
      {title ? <div className="font-semibold mb-1">{title}</div> : null}
      <div>{children}</div>
    </div>
  );
}