'use client';

import Link from 'next/link';
import { FileCheck } from 'lucide-react';
import type { PendingReviewItem } from '@/lib/api';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReviewNotificationItem({ item }: { item: PendingReviewItem }) {
  const { entry, case: caseData } = item;
  const caseTitle = caseData.nama_para_pihak || caseData.nomor_draft || caseData.jenis_akta || 'Berkas';
  const docLabel = entry.item_label || entry.item_key;
  const caseUrl = `/cases/${caseData.id}?tab=dokumen`;

  return (
    <Link
      href={caseUrl}
      className="flex gap-3 px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border/80 last:border-0"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <FileCheck className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          <span className="text-muted-foreground">{entry.uploaded_by_name}</span>
          {' mengunggah '}
          <span className="text-primary">{docLabel}</span>
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5" title={caseTitle}>
          Berkas: {caseTitle}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatRelativeTime(entry.uploaded_at)}
        </p>
      </div>
    </Link>
  );
}
