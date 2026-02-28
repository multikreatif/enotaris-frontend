'use client';

import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getPendingReviewItemsApi, type PendingReviewItem } from '@/lib/api';

export interface PendingReviewState {
  items: PendingReviewItem[];
  pendingCount: number;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const PendingReviewContext = React.createContext<PendingReviewState | null>(null);

export function PendingReviewProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [items, setItems] = useState<PendingReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isNotaris = user?.role_name?.toLowerCase() === 'notaris';

  const refetch = useCallback(async () => {
    if (!token || !isNotaris) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      const list = await getPendingReviewItemsApi(token, { caseLimit: 50 });
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, isNotaris]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const value: PendingReviewState = {
    items,
    pendingCount: items.length,
    isLoading,
    refetch,
  };

  return (
    <PendingReviewContext.Provider value={value}>
      {children}
    </PendingReviewContext.Provider>
  );
}

export function usePendingReview(): PendingReviewState {
  const ctx = useContext(PendingReviewContext);
  if (!ctx) {
    return {
      items: [],
      pendingCount: 0,
      isLoading: false,
      refetch: async () => {},
    };
  }
  return ctx;
}
