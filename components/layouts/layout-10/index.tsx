'use client';

import { LayoutProvider } from '@/components/layouts/layout-1/components/context';
import { OfficeProvider } from '@/providers/office-provider';
import { Main } from './components/main';

export function Layout10({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <OfficeProvider>
        <Main>{children}</Main>
      </OfficeProvider>
    </LayoutProvider>
  );
}
