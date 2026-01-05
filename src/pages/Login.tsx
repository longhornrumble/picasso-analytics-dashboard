/**
 * Login Page
 * Premium Emerald Design System
 *
 * An aspirational gateway that welcomes users into the
 * Mission Intelligence Platform with world-class design.
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3 sm:p-6 relative overflow-hidden">
      {/* Background "Vortex" - Atmospheric emerald glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(80, 200, 120, 0.07) 0%, transparent 60%)',
          filter: 'blur(120px)',
        }}
      />

      {/* Main Container - animate-in */}
      <div className="max-w-[480px] w-full relative animate-in fade-in zoom-in-95 duration-500">
        {/* Master Card - Ultra-round cornering */}
        <div
          className="bg-white p-6 sm:p-10 md:p-12 text-center relative"
          style={{
            borderRadius: '2rem',
            boxShadow: '0 25px 80px -20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.02)',
          }}
        >
          {/* Logo */}
          <div className="mb-8">
            <img
              src="/myrecruiter-logo.png"
              alt="MyRecruiter"
              className="h-12 w-auto mx-auto"
            />
          </div>

          {/* Meta Badge */}
          <span
            className="inline-flex items-center px-4 py-1.5 mb-6 font-black uppercase bg-primary-50 text-primary-500"
            style={{
              fontSize: '10px',
              letterSpacing: '0.25em',
              borderRadius: '2rem',
            }}
          >
            Mission Intelligence
          </span>

          {/* Headline */}
          <h1
            className="text-3xl md:text-4xl font-black text-slate-900 mb-3"
            style={{ letterSpacing: '-0.02em' }}
          >
            Analytics Dashboard
          </h1>

          {/* Subtitle */}
          <p className="text-lg font-medium text-slate-500 mb-10">
            Sign in to access your intelligence platform
          </p>

          {/* Error message */}
          {error && (
            <div className="mb-8 p-4 text-left rounded-2xl bg-danger-50 border border-danger-100">
              <p className="text-sm text-danger-600 font-medium">{error}</p>
            </div>
          )}

          {/* Login options */}
          {!showManualLogin ? (
            <div className="space-y-5">
              {/* Primary CTA - Bubble SSO */}
              <button
                onClick={handleBubbleLogin}
                className="w-full py-4 px-6 text-white font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 bg-primary-500 rounded-[1.25rem]"
                style={{
                  boxShadow: '0 16px 32px -8px rgba(80, 200, 120, 0.4), 0 6px 12px -6px rgba(80, 200, 120, 0.3)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign in with MyRecruiter
              </button>

              {/* Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center">
                  <span
                    className="px-4 bg-white font-black uppercase text-slate-300"
                    style={{ fontSize: '10px', letterSpacing: '0.2em' }}
                  >
                    or
                  </span>
                </div>
              </div>

              {/* Secondary CTA - Ghost Button */}
              <button
                onClick={() => setShowManualLogin(true)}
                className="w-full py-4 px-6 border-2 border-slate-100 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-200 transition-all duration-200"
                style={{ borderRadius: '1.25rem' }}
              >
                Enter Token Manually
              </button>
            </div>
          ) : (
            <form onSubmit={handleManualLogin} className="text-left">
              {/* Token Input Section */}
              <div
                className="p-6 mb-6"
                style={{
                  borderRadius: '1.5rem',
                  backgroundColor: 'rgba(248, 250, 252, 0.6)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {/* Meta Label */}
                <label
                  htmlFor="token"
                  className="block font-black uppercase text-slate-400 mb-4"
                  style={{ fontSize: '10px', letterSpacing: '0.25em' }}
                >
                  JWT Token
                </label>
                <textarea
                  id="token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste your JWT token here..."
                  className="w-full px-4 py-3 border-2 border-slate-100 text-sm focus:border-emerald-300 focus:outline-none resize-none h-28 font-mono text-slate-700 placeholder-slate-300 transition-colors duration-200"
                  style={{ borderRadius: '1rem' }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!manualToken.trim()}
                className="w-full py-4 px-6 text-white font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 bg-primary-500 rounded-[1.25rem]"
                style={{
                  boxShadow: manualToken.trim()
                    ? '0 16px 32px -8px rgba(80, 200, 120, 0.4), 0 6px 12px -6px rgba(80, 200, 120, 0.3)'
                    : 'none',
                }}
              >
                Sign In
              </button>

              {/* Back Link */}
              <button
                type="button"
                onClick={() => setShowManualLogin(false)}
                className="w-full mt-4 py-3 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to login options
              </button>
            </form>
          )}

          {/* Help text */}
          <p className="mt-10 text-sm text-slate-400">
            Having trouble signing in?{' '}
            <a
              href="mailto:support@myrecruiter.ai"
              className="font-medium transition-colors duration-200 hover:underline text-primary-500"
            >
              Contact support
            </a>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-400">
          Mission Intelligence Platform
        </p>
      </div>
    </div>
  );
}
