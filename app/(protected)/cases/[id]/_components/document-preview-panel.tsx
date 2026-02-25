'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogBody,
} from '@/components/ui/dialog';
import { FileText, ChevronLeft, ChevronRight, X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import type { CaseDocumentEntryItem } from '@/lib/api';

const SYNCFUSION_THEME_URL = 'https://cdn.syncfusion.com/ej2/32.2.7/material.css';
const SYNCFUSION_LINK_ID = 'syncfusion-pdfviewer-theme';

// Syncfusion PDF Viewer - load only on client (standalone: documentPath URL + resourceUrl)
const PdfViewerComponent = dynamic(
  () => import('@syncfusion/ej2-react-pdfviewer').then((mod) => mod.PdfViewerComponent),
  { ssr: false, loading: () => <div className="flex h-[500px] items-center justify-center text-muted-foreground">Memuat viewer PDF...</div> }
);

const SYNCFUSION_PDFVIEWER_LIB = 'https://cdn.syncfusion.com/ej2/32.2.7/dist/ej2-pdfviewer-lib';

function isPdfUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\.pdf$/i.test(path) || path.toLowerCase().includes('.pdf');
  } catch {
    return false;
  }
}

function isImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
  } catch {
    return false;
  }
}

export interface DocumentPreviewPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName: string;
  entry: CaseDocumentEntryItem;
  isNotaris: boolean;
  onVerify: (entry: CaseDocumentEntryItem) => void;
  onReject: (entry: CaseDocumentEntryItem, note: string) => void;
  patchingEntryId: string | null;
}

export function DocumentPreviewPanel({
  open,
  onOpenChange,
  documentName,
  entry,
  isNotaris,
  onVerify,
  onReject,
  patchingEntryId,
}: DocumentPreviewPanelProps) {
  const [rejectNote, setRejectNote] = useState('');
  const isPdf = isPdfUrl(entry.presign_url);
  const isImage = isImageUrl(entry.presign_url);
  const uploadedDate = entry.uploaded_at
    ? new Date(entry.uploaded_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';

  useEffect(() => {
    if (open) setRejectNote(entry.rejection_note ?? '');
  }, [open, entry.rejection_note]);

  const handleVerify = useCallback(() => {
    if (!confirm('Tandai dokumen ini sebagai Terverifikasi?')) return;
    onVerify(entry);
  }, [entry, onVerify]);

  const handleReject = useCallback(() => {
    onReject(entry, rejectNote.trim());
  }, [entry, rejectNote, onReject]);

  const initial = (entry.uploaded_by_name || 'S').charAt(0).toUpperCase();

  // Load Syncfusion CSS from CDN when panel opens (avoids @import order issue in bundled CSS)
  useEffect(() => {
    if (!open) return;
    if (document.getElementById(SYNCFUSION_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = SYNCFUSION_LINK_ID;
    link.rel = 'stylesheet';
    link.href = SYNCFUSION_THEME_URL;
    document.head.appendChild(link);
    return () => {
      document.getElementById(SYNCFUSION_LINK_ID)?.remove();
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-full min-w-[800px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <div className="grid grid-cols-[1fr_400px] flex-1 min-h-0 w-full overflow-hidden">
          {/* Kiri: Preview dokumen (dark) */}
          <div className="flex flex-col bg-slate-800 text-slate-100 min-w-0">
            <div className="flex items-center justify-between gap-4 border-b border-slate-700 px-4 py-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="size-5 shrink-0 text-slate-400" />
                <span className="truncate font-medium">{documentName}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  className="rounded p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                  aria-label="Dokumen sebelumnya"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  className="rounded p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                  aria-label="Dokumen berikutnya"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex flex-col p-4">
              <div className="flex-1 rounded-lg border-2 border-dashed border-slate-600 bg-slate-900/50 overflow-hidden flex flex-col min-h-[400px]">
                {isPdf ? (
                  <div className="flex-1 min-h-[480px] w-full [&_.e-pv-viewer-container]:!bg-slate-900">
                    <PdfViewerComponent
                      documentPath={entry.presign_url}
                      resourceUrl={SYNCFUSION_PDFVIEWER_LIB}
                      style={{ height: '100%', minHeight: '480px' }}
                      serviceUrl=""
                    />
                  </div>
                ) : isImage ? (
                  <div className="flex-1 flex items-center justify-center p-4 min-h-[400px]">
                    <img
                      src={entry.presign_url}
                      alt={documentName}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-6">
                    <a
                      href={entry.presign_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-slate-400 hover:text-white underline"
                    >
                      Buka dokumen di tab baru
                    </a>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Preview Dokumen: {documentName}
              </p>
            </div>
          </div>

          {/* Kanan: Panel Verifikasi */}
          <div className="flex flex-col border-l border-border bg-card overflow-y-auto w-[400px] shrink-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
              <h3 className="text-base font-semibold text-foreground">Panel Verifikasi</h3>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Tutup"
              >
                <X className="size-5" />
              </button>
            </div>
            <DialogBody className="flex-1 flex flex-col gap-6 p-5">
              {/* DETAIL PENGIRIM */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Detail Pengirim
                </h4>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold">
                    {initial}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{entry.uploaded_by_name || '-'}</p>
                    <p className="text-xs text-muted-foreground">Diunggah pada: {uploadedDate}</p>
                  </div>
                </div>
              </div>

              {/* STATUS FISIK */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status Fisik
                </h4>
                {entry.physical_received ? (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-2 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <CheckCircle2 className="size-5 shrink-0" />
                    <span className="text-sm font-medium">Fisik Sudah Ada di Kantor</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/15 px-3 py-2 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                    <AlertTriangle className="size-5 shrink-0" />
                    <span className="text-sm font-medium">Hanya Scan (Fisik Belum Ada)</span>
                  </div>
                )}
              </div>

              {/* KEPUTUSAN VERIFIKASI (hanya notaris) */}
              {isNotaris && entry.verification_status === 'pending' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Keputusan Verifikasi
                  </h4>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      className="w-full justify-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                      disabled={patchingEntryId === entry.id}
                      onClick={handleVerify}
                    >
                      <CheckCircle2 className="size-5" />
                      Terima Dokumen
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full justify-center gap-2"
                      disabled={patchingEntryId === entry.id}
                      onClick={() => {
                        if (confirm('Tolak dokumen ini?')) {
                          handleReject();
                          onOpenChange(false);
                        }
                      }}
                    >
                      <XCircle className="size-5" />
                      Tolak Dokumen
                    </Button>
                  </div>
                </div>
              )}

              {/* CATATAN PENOLAKAN / KOREKSI */}
              {isNotaris && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Catatan Penolakan / Koreksi
                  </h4>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Tuliskan alasan jika menolak dokumen ini..."
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <Info className="size-4 shrink-0 mt-0.5" />
                    <p>
                      Keputusan Anda akan dicatat dalam timeline berkas dan notifikasi akan dikirim ke staf terkait.
                    </p>
                  </div>
                </div>
              )}
            </DialogBody>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
