'use client';

import { ReactNode, useEffect, useState } from 'react';
import { FileCheck } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { usePendingReview } from '@/providers/pending-review-provider';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReviewNotificationItem } from './notifications/review-notification-item';

export function NotificationsSheet({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { items, isLoading, refetch } = usePendingReview();
  const isNotaris = user?.role_name?.toLowerCase() === 'notaris';

  useEffect(() => {
    if (open && isNotaris) refetch();
  }, [open, isNotaris, refetch]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 sm:w-[440px] inset-5 start-auto h-auto rounded-lg p-0 sm:max-w-none [&_[data-slot=sheet-close]]:top-4.5 [&_[data-slot=sheet-close]]:end-5">
        <SheetHeader className="mb-0 border-b border-border">
          <SheetTitle className="p-4">Notifikasi</SheetTitle>
        </SheetHeader>
        <SheetBody className="grow p-0">
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="py-2">
              {!isNotaris && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Notifikasi verifikasi dokumen hanya untuk notaris.
                </div>
              )}
              {isNotaris && (
                <>
                  <div className="px-4 pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      <FileCheck className="size-3.5" />
                      Perlu Verifikasi
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Dokumen yang diunggah staff dan menunggu review Anda
                    </p>
                  </div>
                  {isLoading && (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Memuat...
                    </div>
                  )}
                  {!isLoading && items.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Tidak ada dokumen yang menunggu verifikasi.
                    </div>
                  )}
                  {!isLoading && items.length > 0 && (
                    <div className="flex flex-col">
                      {items.map((item) => (
                        <ReviewNotificationItem key={item.entry.id} item={item} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
