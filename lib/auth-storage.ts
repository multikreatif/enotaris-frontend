/**
 * Client-side auth persistence (localStorage).
 */

import type { LoginResult, UserResponse } from './auth-types';

const STORAGE_KEY = 'enotaris_auth';

export interface StoredAuth {
  token: string;
  expiresAt: string;
  user: UserResponse;
}

function isExpired(expiresAt: string): boolean {
  try {
    return new Date(expiresAt).getTime() <= Date.now();
  } catch {
    return true;
  }
}

export function saveAuth(result: LoginResult): void {
  if (typeof window === 'undefined') return;
  const data: StoredAuth = {
    token: result.token,
    expiresAt: result.expires_at,
    user: result.user,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredAuth;
    if (!data.token || !data.user || isExpired(data.expiresAt)) {
      clearAuth();
      return null;
    }
    return data;
  } catch {
    clearAuth();
    return null;
  }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
