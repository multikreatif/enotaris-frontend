import { ReactNode, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { SyncfusionLicenseProvider } from '@/components/syncfusion-license';
import { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/providers/auth-provider';

import '@/styles/globals.css';
import '@keenthemes/ktui/dist/styles.css';

export const metadata: Metadata = {
  title: {
    template: '%s | eNotaris',
    default: 'eNotaris',
  },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html className="h-full" suppressHydrationWarning>
      <body
        className={cn(
          'antialiased flex h-full text-base text-foreground bg-background font-sans',
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          storageKey="nextjs-theme"
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <SyncfusionLicenseProvider>
            <AuthProvider>
            <TooltipProvider delayDuration={0}>
              <Suspense>{children}</Suspense>
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
          </SyncfusionLicenseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
