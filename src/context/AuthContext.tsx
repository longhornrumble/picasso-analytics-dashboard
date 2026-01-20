/**
 * Authentication Context
 * Handles Bubble SSO integration and token management
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthState, User, DashboardFeatures, UserRole } from '../types/analytics';
import { fetchFeatures } from '../services/analyticsApi';

interface AuthContextType extends AuthState {
  login: (token: string) => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Bubble SSO configuration
const BUBBLE_AUTH_URL = import.meta.env.VITE_BUBBLE_AUTH_URL || '';
const TOKEN_KEY = 'analytics_token';
const USER_KEY = 'analytics_user';

/**
 * Decode JWT payload (without verification - verification happens on backend)
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return Date.now() >= payload.exp * 1000;
}

/**
 * Extract dashboard features from JWT payload with secure defaults.
 * API call will enrich with actual features - these are fallbacks only.
 * - conversations: true (FREE tier, always available)
 * - forms: false (PREMIUM only - API provides actual value)
 * - attribution: false (PREMIUM only)
 */
function extractDashboardFeatures(payload: Record<string, unknown>): DashboardFeatures {
  // Type-safe extraction with runtime check
  const features = (typeof payload.features === 'object' && payload.features !== null)
    ? (payload.features as Record<string, unknown>)
    : {};

  return {
    dashboard_conversations: features.dashboard_conversations !== false, // default true (FREE tier)
    dashboard_forms: features.dashboard_forms === true,                  // default false (PREMIUM only)
    dashboard_attribution: features.dashboard_attribution === true,      // default false (PREMIUM only)
  };
}

/**
 * Extract user from JWT token
 */
function extractUserFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // Validate and normalize role if present
  const rawRole = payload.role as string | undefined;
  const normalizedRole = rawRole?.toLowerCase().replace(/\s+/g, '_'); // "Super Admin" -> "super_admin"
  const validRoles: UserRole[] = ['super_admin', 'admin', 'viewer'];
  const validatedRole = normalizedRole && validRoles.includes(normalizedRole as UserRole)
    ? (normalizedRole as UserRole)
    : undefined;

  return {
    tenant_id: (payload.tenant_id as string) || (payload.sub as string) || '',
    tenant_hash: (payload.tenant_hash as string) || '',
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    role: validatedRole,
    company: payload.company as string | undefined,
    features: extractDashboardFeatures(payload),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    loading: true,
    error: null,
  });

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && !isTokenExpired(storedToken)) {
        const user = storedUser ? JSON.parse(storedUser) : extractUserFromToken(storedToken);
        setState({
          isAuthenticated: true,
          user,
          token: storedToken,
          loading: false,
          error: null,
        });
      } else {
        // Clear expired token
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({
          isAuthenticated: false,
          user: null,
          token: null,
          loading: false,
          error: null,
        });
      }
    };

    // Check for token in URL (Bubble SSO callback)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
      // Clear token from URL
      window.history.replaceState({}, '', window.location.pathname);

      if (!isTokenExpired(tokenFromUrl)) {
        const user = extractUserFromToken(tokenFromUrl);
        localStorage.setItem(TOKEN_KEY, tokenFromUrl);
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));

        setState({
          isAuthenticated: true,
          user,
          token: tokenFromUrl,
          loading: false,
          error: null,
        });
        return;
      }
    }

    initAuth();
  }, []);

  // Auto-redirect to Bubble login when not authenticated
  useEffect(() => {
    if (!state.loading && !state.isAuthenticated && BUBBLE_AUTH_URL) {
      // Not authenticated and Bubble URL is configured - redirect immediately
      window.location.href = BUBBLE_AUTH_URL;
    }
  }, [state.loading, state.isAuthenticated]);

  // Fetch features from API after authentication
  useEffect(() => {
    async function loadFeatures() {
      if (!state.isAuthenticated || !state.token) return;

      try {
        const response = await fetchFeatures();
        setState(prev => {
          if (!prev.user) return prev;
          const updatedUser = {
            ...prev.user,
            features: response.features,
          };
          // Update localStorage with enriched user
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
          return {
            ...prev,
            user: updatedUser,
          };
        });
      } catch (error) {
        // Features fetch failed - use defaults from JWT extraction
        console.warn('Failed to fetch features from API, using defaults:', error);
      }
    }

    loadFeatures();
  }, [state.isAuthenticated, state.token]);

  const login = useCallback((token: string) => {
    if (isTokenExpired(token)) {
      setState(prev => ({ ...prev, error: 'Token expired' }));
      return;
    }

    const user = extractUserFromToken(token);
    localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));

    setState({
      isAuthenticated: true,
      user,
      token,
      loading: false,
      error: null,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setState({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
    });

    // Redirect to Bubble login if configured
    if (BUBBLE_AUTH_URL) {
      window.location.href = BUBBLE_AUTH_URL;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    // Bubble SSO refresh would go here
    // For now, just redirect to Bubble auth
    if (BUBBLE_AUTH_URL) {
      window.location.href = BUBBLE_AUTH_URL;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
