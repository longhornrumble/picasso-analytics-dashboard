/**
 * Login Page
 * Displays when user is not authenticated
 * Supports Bubble SSO redirect and manual token entry (for testing)
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const BUBBLE_AUTH_URL = import.meta.env.VITE_BUBBLE_AUTH_URL || '';

export function Login() {
  const { login, error } = useAuth();
  const [manualToken, setManualToken] = useState('');
  const [showManualLogin, setShowManualLogin] = useState(false);

  const handleBubbleLogin = () => {
    if (BUBBLE_AUTH_URL) {
      window.location.href = BUBBLE_AUTH_URL;
    } else {
      setShowManualLogin(true);
    }
  };

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      login(manualToken.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Form Analytics</h1>
          <p className="text-gray-500 mt-2">Sign in to view your analytics dashboard</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Login options */}
        {!showManualLogin ? (
          <div className="space-y-4">
            {/* Bubble SSO button */}
            <button
              onClick={handleBubbleLogin}
              className="w-full py-3 px-4 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Sign in with MyRecruiter
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            {/* Manual token entry toggle */}
            <button
              onClick={() => setShowManualLogin(true)}
              className="w-full py-3 px-4 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Enter Token Manually
            </button>
          </div>
        ) : (
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
                JWT Token
              </label>
              <textarea
                id="token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste your JWT token here..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none h-32 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!manualToken.trim()}
              className="w-full py-3 px-4 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setShowManualLogin(false)}
              className="w-full py-3 px-4 text-gray-600 hover:text-gray-900 text-sm"
            >
              Back to login options
            </button>
          </form>
        )}

        {/* Help text */}
        <p className="mt-8 text-center text-xs text-gray-400">
          Having trouble signing in?{' '}
          <a href="mailto:support@myrecruiter.ai" className="text-green-500 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
