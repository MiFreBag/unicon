// client/src/ui/Modal.jsx
import React from 'react';

export default function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-[600px] w-[90%] p-6">
        {title ? <h3 className="text-[24px] leading-8 font-bold text-swarco-grey-900 mb-4">{title}</h3> : null}
        <div>{children}</div>
        {footer ? <div className="mt-6 flex items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}