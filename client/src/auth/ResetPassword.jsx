// client/src/auth/ResetPassword.jsx
import React from 'react';

export default function ResetPassword() {
  // This is a demo placeholder. No server endpoint for password reset exists.
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const token = params.get('token');
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-gray-900">
      <div className="w-full max-w-md border rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Reset password</h1>
        {token ? (
          <p className="text-sm text-gray-600 mb-4">A reset token was provided, but password reset is not implemented in this demo build.</p>
        ) : (
          <p className="text-sm text-gray-600 mb-4">Password reset is not implemented in this demo build.</p>
        )}
        <button className="h-10 px-4 bg-[#004b8d] text-white rounded hover:bg-[#003a6c]" onClick={() => { window.location.href = '/unicon/'; }}>
          Back to login
        </button>
      </div>
    </div>
  );
}
