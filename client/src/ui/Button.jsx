// client/src/ui/Button.jsx
import React from 'react';

const sizeClasses = {
  sm: 'h-8 px-3 text-[12px] leading-4', // 32px, 12/16
  md: 'h-10 px-4 text-base leading-6',  // 40px, 16/24
  lg: 'h-12 px-5 text-base leading-6',  // 48px, 16/24
};

const base = 'inline-flex items-center justify-center rounded-[4px] font-semibold select-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

const variants = {
  primary: 'bg-swarco-blue-800 text-white hover:bg-swarco-blue-600 active:bg-swarco-blue-400 focus:outline-none focus:ring-2 focus:ring-swarco-blue-200',
  secondary: 'border border-gray-300 text-swarco-blue-800 bg-white hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-swarco-blue-200',
};

export default function Button({ variant = 'primary', size = 'md', className = '', children, leftIcon: LeftIcon, rightIcon: RightIcon, leftEl = null, rightEl = null, ...rest }) {
  return (
    <button className={[base, variants[variant], sizeClasses[size], className].join(' ')} {...rest}>
      {leftEl ? leftEl : (LeftIcon ? <LeftIcon size={16} className="mr-2" /> : null)}
      {children}
      {rightEl ? rightEl : (RightIcon ? <RightIcon size={16} className="ml-2" /> : null)}
    </button>
  );
}