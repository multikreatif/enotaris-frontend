'use client';

import { useOffice } from '@/providers/office-provider';

/**
 * Label konsisten di atas konten: hanya [Nama Kantor] dengan font eye-catching.
 */
export function OfficeBar() {
  const { officeName, isLoading } = useOffice();

  if (isLoading) {
    return (
      <div className="container border-b border-border/60 bg-muted/30 px-4 py-2.5 max-sm:hidden">
        <span className="text-sm text-muted-foreground animate-pulse">Memuat kantor...</span>
      </div>
    );
  }

  if (!officeName) return null;

  return (
    <div
      className="container border-b border-border/60 bg-muted/30 px-4 py-3 max-sm:hidden"
      role="banner"
      aria-label={officeName}
    >
      <span
        className="truncate block text-xl font-extrabold tracking-wide text-primary drop-shadow-sm dark:drop-shadow-none md:text-2xl"
        title={officeName}
      >
        {officeName}
      </span>
    </div>
  );
}
