'use client';

export function ScreenLoader() {
  return (
    <div className="flex flex-col items-center gap-3 justify-center fixed inset-0 z-50 bg-background">
      <div
        className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        aria-hidden
      />
      <p className="text-muted-foreground text-sm">Memuat...</p>
    </div>
  );
}
