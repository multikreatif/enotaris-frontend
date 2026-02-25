'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { UserResponse } from '@/lib/auth-types';
import { loginApi, logoutApi } from '@/lib/api';
import { clearAuth, loadAuth, saveAuth } from '@/lib/auth-storage';

export interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (officeId: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

/** Same on server and client to avoid hydration mismatch; real state set in useEffect. */
const INITIAL_STATE: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    const stored = loadAuth();
    setState({
      user: stored?.user ?? null,
      token: stored?.token ?? null,
      isLoading: false,
      isAuthenticated: !!stored?.token,
    });
  }, []);

  const login = useCallback(async (officeId: string, email: string, password: string) => {
    const result = await loginApi({ office_id: officeId, email, password });
    saveAuth(result);
    setState({
      user: result.user,
      token: result.token,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(async () => {
    const token = state.token ?? loadAuth()?.token;
    if (token) {
      try {
        await logoutApi(token);
      } catch {
        // ignore
      }
    }
    clearAuth();
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, [state.token]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
