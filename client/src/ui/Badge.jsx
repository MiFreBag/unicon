// client/src/ui/Badge.jsx
import React from 'react';

const variants = {
  default: 'bg-swarco-grey-200 text-swarco-grey-900',
  success: 'bg-swarco-green-200 text-swarco-green-800',
  error: 'bg-swarco-red-200 text-swarco-red-800',
  info: 'bg-swarco-blue-100 text-swarco-blue-900',
};

export default function Badge({ variant='default', children, className='' }) {
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[12px] leading-4 font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}