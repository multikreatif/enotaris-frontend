'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderOpen, UploadCloud, Search, FileText } from 'lucide-react';
import { getDocumentsApi, uploadDocumentApi, type DocumentItem } from '@/lib/api';

export default function DocumentsPage() {
  const { token } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    getDocumentsApi(token)
      .then((list) => setDocuments(list))
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Gagal memuat dokumen');
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title={
            <span className="inline-flex items-center gap-2">
              <FolderOpen className="size-5" />
              <span>Dokumen</span>
            </span>
          }
          description="Repositori dokumen kantor (draft, dokumen klien, dan final)."
        />
        <ToolbarActions>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/document-templates" className="gap-2">
                <FileText className="size-4" />
                Template Dokumen
              </Link>
            </Button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama dokumen atau folder..."
                className="pl-8 w-64"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <UploadCloud className="me-2 size-4" />
              Upload Dokumen
            </Button>
          </div>
        </ToolbarActions>
      </Toolbar>

      <div className="container pb-10">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !token) return;
            try {
              setError(null);
              setLoading(true);
              const uploaded = await uploadDocumentApi(token, file);
              setDocuments((prev) => [uploaded, ...prev]);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen');
            } finally {
              setLoading(false);
              e.target.value = '';
            }
          }}
        />
        <div ref={containerRef} className="mt-4">
          {error && <p className="mb-4 text-destructive text-sm">{error}</p>}
          <div className="kt-card p-6">
            {loading ? (
              <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-10">
                <FolderOpen className="size-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Belum ada dokumen yang ditampilkan.</p>
                  <p className="text-xs text-muted-foreground">
                    Gunakan tombol &quot;Upload Dokumen&quot; untuk mulai mengunggah berkas ke penyimpanan dokumen.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {documents.length} dokumen
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {documents
                    .filter((d) =>
                      search.trim()
                        ? d.file_name.toLowerCase().includes(search.trim().toLowerCase())
                        : true,
                    )
                    .map((d) => (
                      <a
                        key={d.key}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-4 py-2 hover:bg-muted/40 rounded-md px-2 -mx-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FolderOpen className="size-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{d.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(d.uploaded_at).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {(d.size / 1024).toFixed(1)} KB
                        </span>
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

