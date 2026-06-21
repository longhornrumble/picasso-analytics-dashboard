/**
 * useAuth — consumer hook for AuthContext.
 *
 * Lives in its own file (separate from AuthProvider in AuthContext.tsx)
 * so Vite/React-Refresh can hot-reload the provider component without
 * tripping `react-refresh/only-export-components`.
 */

import { createContext, useContext } from 'react';
import type { AuthState } from '../types/analytics';

export interface AuthContextType extends AuthState {
  login: (token: string) => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
  /** Re-fetch dashboard feature entitlements from /features and update the user.
   *  Call after a runtime change to entitlements (e.g. toggling scheduling
   *  activation) so tab visibility tracks live state instead of the login cache. */
  refreshFeatures: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
