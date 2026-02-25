'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getCurrentOfficeApi } from '@/lib/api';

export interface OfficeState {
  officeName: string;
  officeId: string | null;
  isLoading: boolean;
}

const initialState: OfficeState = {
  officeName: '',
  officeId: null,
  isLoading: false,
};

const OfficeContext = React.createContext<OfficeState>(initialState);

export function OfficeProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated } = useAuth();
  const [state, setState] = useState<OfficeState>(initialState);

  const fetchOffice = useCallback(async () => {
    if (!token) {
      setState({ officeName: '', officeId: null, isLoading: false });
      return;
    }
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const profile = await getCurrentOfficeApi(token);
      setState({
        officeName: profile.name?.trim() || 'Kantor',
        officeId: profile.id ?? null,
        isLoading: false,
      });
    } catch {
      setState({
        officeName: '',
        officeId: null,
        isLoading: false,
      });
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchOffice();
    } else {
      setState(initialState);
    }
  }, [isAuthenticated, token, fetchOffice]);

  return (
    <OfficeContext.Provider value={state}>
      {children}
    </OfficeContext.Provider>
  );
}

export function useOffice(): OfficeState {
  return React.useContext(OfficeContext);
}
