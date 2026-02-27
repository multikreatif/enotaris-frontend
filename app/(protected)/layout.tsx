'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { ScreenLoader } from '@/components/screen-loader';
import { Layout1 } from '@/components/layouts/layout-1';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/signin');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <ScreenLoader />;
  }

  if (!isAuthenticated) {
    return null;
  }

  // Gunakan Layout1 dengan dark sidebar (seperti eNotaris).
  return <Layout1 defaultSidebarTheme="dark">{children}</Layout1>;
}
