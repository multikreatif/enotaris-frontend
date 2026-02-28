'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Archive,
  CheckSquare2,
  Clock3,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Library,
  ScrollText,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  getDocumentsApi,
  getDocumentsStatsApi,
  getDocumentRequirementTemplatesApi,
  getProtocolEntriesApi,
  uploadDocumentApi,
  type DocumentItem,
  type DocumentStats,
  type DocumentRequirementTemplateResponse,
  type ProtocolEntry,
} from '@/lib/api';

type MenuKey = 'dashboard' | 'client' | 'templates' | 'output' | 'expiry' | 'sop';

interface CategorisedDocument extends DocumentItem {
  category: 'client' | 'template' | 'output' | 'other';
  caseId?: string;
  folderLabel?: string;
}

export default function DocumentsPage() {
  const { token } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeMenu, setActiveMenu] = useState<MenuKey>('dashboard');
  const [search, setSearch] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [templates, setTemplates] = useState<DocumentRequirementTemplateResponse[]>([]);
  const [protocolEntries, setProtocolEntries] = useState<ProtocolEntry[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingProtocol, setLoadingProtocol] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(typeof window !== 'undefined' && window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleToggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAllVisible = (visible: CategorisedDocument[]) => {
    setSelectedKeys(new Set(visible.map((d) => d.key)));
  };

  const handleClearSelection = () => {
    setSelectedKeys(new Set());
  };

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

  useEffect(() => {
    if (!token) return;
    setLoadingTemplates(true);
    getDocumentRequirementTemplatesApi(token)
      .then((list) => setTemplates(list))
      .catch(() => {
        // templates are optional in this view
      })
      .finally(() => setLoadingTemplates(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoadingStats(true);
    getDocumentsStatsApi(token)
      .then((data) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setLoadingProtocol(true);
    getProtocolEntriesApi(token, { limit: 100, offset: 0 })
      .then((res) => setProtocolEntries(res.data))
      .catch(() => {
        // protocol entries are optional enrichment
      })
      .finally(() => setLoadingProtocol(false));
  }, [token]);

  const categorisedDocuments: CategorisedDocument[] = useMemo(() => {
    return documents.map((doc) => {
      const key = doc.key || '';
      const lowerName = doc.file_name.toLowerCase();

      let category: CategorisedDocument['category'] = 'other';
      let caseId: string | undefined;
      let folderLabel: string | undefined;

      if (key.includes('/cases/')) {
        const parts = key.split('/');
        const casesIdx = parts.indexOf('cases');
        if (casesIdx >= 0 && parts.length > casesIdx + 1) caseId = parts[casesIdx + 1];
        folderLabel = parts.slice(casesIdx >= 0 ? casesIdx + 2 : 0, -1).join(' / ') || undefined;
        category = 'client';
      }

      if (key.includes('/templates/') || lowerName.includes('template')) {
        category = 'template';
      }

      if (key.toLowerCase().includes('minuta') || key.toLowerCase().includes('salinan')) {
        category = 'output';
      }

      return {
        ...doc,
        category,
        caseId,
        folderLabel,
      };
    });
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categorisedDocuments;
    return categorisedDocuments.filter((doc) => {
      return (
        doc.file_name.toLowerCase().includes(term) ||
        doc.key.toLowerCase().includes(term) ||
        (doc.folderLabel && doc.folderLabel.toLowerCase().includes(term))
      );
    });
  }, [categorisedDocuments, search]);

  const clientDocs = filteredDocuments.filter((d) => d.category === 'client');
  const templateDocs = filteredDocuments.filter((d) => d.category === 'template');
  const outputDocs = filteredDocuments.filter((d) => d.category === 'output');

  const identityDocs = useMemo(
    () =>
      filteredDocuments.filter((d) => {
        const name = d.file_name.toLowerCase();
        return (
          name.includes('ktp') ||
          name.includes('kartu tanda penduduk') ||
          name.includes('paspor') ||
          name.includes('passport') ||
          name.includes('surat kuasa')
        );
      }),
    [filteredDocuments],
  );

  const totalSizeBytes = useMemo(
    () => documents.reduce((acc, d) => acc + (d.size || 0), 0),
    [documents],
  );

  const docsLast7Days = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return documents.filter((d) => {
      const t = new Date(d.uploaded_at).getTime();
      return now - t <= sevenDays;
    }).length;
  }, [documents]);

  const activityStream = useMemo(
    () =>
      [...(search.trim() ? filteredDocuments : documents)]
        .sort(
          (a, b) =>
            new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
        )
        .slice(0, 8),
    [documents, filteredDocuments, search],
  );

  const isSearchActive = search.trim().length > 0;

  const handleOpenSelected = useCallback(
    (visible: CategorisedDocument[]) => {
      if (selectedKeys.size === 0) return;
      const visibleMap = new Map(visible.map((d) => [d.key, d]));
      selectedKeys.forEach((key) => {
        const doc = visibleMap.get(key);
        if (doc?.url) {
          window.open(doc.url, '_blank', 'noopener,noreferrer');
        }
      });
    },
    [selectedKeys],
  );

  const protocolByKey = useMemo(() => {
    const map = new Map<string, ProtocolEntry>();
    protocolEntries.forEach((p) => {
      if (p.digital_object_key) {
        map.set(p.digital_object_key, p);
      }
    });
    return map;
  }, [protocolEntries]);

  const renderDashboard = () => {
    const useFiltered = isSearchActive;
    const totalCount = useFiltered
      ? filteredDocuments.length
      : (stats?.total_count ?? documents.length);
    const clientCount = useFiltered
      ? clientDocs.length
      : (stats?.client_count ?? categorisedDocuments.filter((d) => d.category === 'client').length);
    const outputCount = useFiltered
      ? outputDocs.length
      : (stats?.output_count ?? categorisedDocuments.filter((d) => d.category === 'output').length);
    const templateCount = templates.length || (useFiltered ? templateDocs.length : (stats?.template_count ?? templateDocs.length));
    const docsLast7DaysVal = useFiltered
      ? filteredDocuments.filter((d) => {
          const t = new Date(d.uploaded_at).getTime();
          return Date.now() - t <= 7 * 24 * 60 * 60 * 1000;
        }).length
      : (stats?.last_7_days_count ?? docsLast7Days);
    const totalSizeMb = useFiltered
      ? filteredDocuments.reduce((acc, d) => acc + (d.size || 0), 0) / (1024 * 1024)
      : (stats ? stats.total_size_bytes : totalSizeBytes) / (1024 * 1024);
    // Untuk widget penyimpanan selalu pakai total real (bukan filtered) agar sisa hardisk konsisten
    const storageUsedBytes = stats?.total_size_bytes ?? totalSizeBytes;
    const storageUsedMb = storageUsedBytes / (1024 * 1024);

    return (
      <div className="space-y-6">
        {isSearchActive && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Menampilkan <strong className="text-foreground">{filteredDocuments.length}</strong> hasil untuk &quot;<strong className="text-foreground">{search.trim()}</strong>&quot;
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSearch('')}
            >
              Hapus filter
            </Button>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Total Dokumen</p>
                <p className="mt-2 text-2xl font-semibold">{totalCount}</p>
              </div>
              <Badge variant="primary" appearance="light" size="lg" shape="circle">
                <FolderOpen className="size-4" />
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Semua file digital dalam repositori kantor.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Dokumen Klien</p>
                <p className="mt-2 text-2xl font-semibold">{clientCount}</p>
              </div>
              <Badge variant="success" appearance="light" size="lg" shape="circle">
                <LayoutDashboard className="size-4" />
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Tersimpan per berkas akta di seluruh kantor.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Upload 7 Hari Terakhir
                </p>
                <p className="mt-2 text-2xl font-semibold">{docsLast7DaysVal}</p>
              </div>
              <Badge variant="info" appearance="light" size="lg" shape="circle">
                <Clock3 className="size-4" />
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Aktivitas terbaru dari seluruh staf.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Penyimpanan
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {stats?.storage_total_bytes != null && stats.storage_total_bytes > 0
                    ? (() => {
                        const totalMb = stats.storage_total_bytes / (1024 * 1024);
                        const totalStr = totalMb >= 1024
                          ? `${(totalMb / 1024).toFixed(1)} GB`
                          : `${Math.round(totalMb)} MB`;
                        return (
                          <>
                            {storageUsedMb >= 1024
                              ? `${(storageUsedMb / 1024).toFixed(1)} GB`
                              : `${storageUsedMb.toFixed(1)} MB`}
                            <span className="text-muted-foreground font-normal"> / </span>
                            {totalStr}
                          </>
                        );
                      })()
                    : (
                        <>
                          {storageUsedMb >= 1024
                            ? `${(storageUsedMb / 1024).toFixed(1)} GB`
                            : `${storageUsedMb.toFixed(1)} MB`}
                        </>
                      )}
                </p>
              </div>
              <Badge variant="warning" appearance="light" size="lg" shape="circle">
                <Archive className="size-4" />
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {stats?.storage_total_bytes != null && stats.storage_total_bytes > 0
                ? 'Terpakai dan kapasitas total server.'
                : 'Perkiraan ukuran file yang tersimpan.'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold">Activity Stream</p>
                <p className="text-xs text-muted-foreground">
                  8 aktivitas unggah dokumen terbaru.
                </p>
              </div>
            </div>
            {activityStream.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {isSearchActive
                  ? `Tidak ada dokumen yang cocok dengan "${search.trim()}".`
                  : 'Belum ada aktivitas dokumen yang terekam.'}
              </p>
            ) : (
              <ol className="space-y-3">
                {activityStream.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-start gap-3 rounded-md border px-3 py-2 text-xs hover:bg-muted/60 transition-colors"
                  >
                    <div className="mt-1 h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <UploadCloud className="size-3" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <p className="font-medium truncate text-[0.75rem]">
                        {item.file_name}
                      </p>
                      <p className="text-[0.7rem] text-muted-foreground">
                        Diunggah pada{' '}
                        {new Date(item.uploaded_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className="text-[0.7rem] text-muted-foreground whitespace-nowrap">
                      {(item.size / 1024).toFixed(1)} KB
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold mb-1">Ringkasan Template Akta</p>
              {loadingTemplates ? (
                <p className="text-xs text-muted-foreground">Memuat template...</p>
              ) : templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada template dokumen persyaratan yang tersimpan.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-xs">
                  {templates.slice(0, 4).map((tpl) => (
                    <li key={tpl.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{tpl.name}</p>
                        <p className="text-[0.7rem] text-muted-foreground">
                          {tpl.category === 'ppat' ? 'PPAT' : 'Notaris'} •{' '}
                          {tpl.items?.length ?? 0} dokumen syarat
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild size="sm" variant="outline" className="mt-3 w-full justify-center">
                <Link href="/document-templates" className="gap-1.5">
                  <Library className="size-3.5" />
                  Kelola Template
                </Link>
              </Button>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold mb-1">Monitor Identitas Klien</p>
              <p className="text-xs text-muted-foreground mb-2">
                Menandai dokumen yang tampak seperti identitas (KTP, Paspor, Surat Kuasa) untuk
                memudahkan pengecekan masa berlaku di berkas terkait.
              </p>
              <Badge
                variant={identityDocs.length > 0 ? 'warning' : 'secondary'}
                appearance="light"
                size="sm"
                className="mt-1"
              >
                <AlertTriangle className="size-3 mr-1" />
                {identityDocs.length} dokumen perlu pengecekan manual
              </Badge>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderClientDocuments = () => {
    const visible = clientDocs;
    const anySelected = visible.some((d) => selectedKeys.has(d.key));

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Dokumen Berkas (Client Documents)</p>
            <p className="text-xs text-muted-foreground">
              Semua dokumen yang tersimpan di berkas akta (`cases/*`), lintas jenis pekerjaan.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
            <Badge variant="secondary" appearance="light" size="sm">
              {visible.length} dokumen klien
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border rounded-lg bg-muted/40 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <CheckSquare2 className="size-3.5 text-muted-foreground" />
            <span className="font-medium">Tindakan massal</span>
            <span className="text-muted-foreground">
              ({selectedKeys.size} dipilih dari {visible.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={visible.length === 0}
              onClick={() => handleSelectAllVisible(visible)}
            >
              Pilih semua
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedKeys.size === 0}
              onClick={handleClearSelection}
            >
              Hapus pilihan
            </Button>
            <Button
              size="sm"
              disabled={!anySelected}
              onClick={() => handleOpenSelected(visible)}
            >
              Buka dokumen terpilih
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <FolderOpen className="size-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Belum ada dokumen berkas yang ditemukan.</p>
              <p className="text-xs text-muted-foreground">
                Upload dokumen melalui tab Dokumen di masing-masing berkas akta.
              </p>
            </div>
          </div>
        ) : (
          <div className="kt-card-table">
            <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
              <table className="kt-table w-full align-middle">
                <thead>
                  <tr>
                    <th scope="col" className="w-12">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">
                          <CheckSquare2 className="inline size-3.5" />
                        </span>
                      </span>
                    </th>
                    <th scope="col">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Nama Dokumen</span>
                      </span>
                    </th>
                    <th scope="col">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Lokasi / Berkas</span>
                      </span>
                    </th>
                    <th scope="col" className="text-right w-24">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Ukuran</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((doc) => (
                    <tr
                      key={doc.key}
                      onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      className="cursor-pointer hover:bg-muted/60"
                      role="button"
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="size-3.5 accent-primary"
                          checked={selectedKeys.has(doc.key)}
                          onChange={() => handleToggleSelect(doc.key)}
                        />
                      </td>
                      <td>
                        <p className="truncate text-sm font-medium">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.uploaded_at).toLocaleString('id-ID')}
                        </p>
                      </td>
                      <td>
                        <p className="truncate text-sm">
                          {doc.caseId ? `Berkas #${doc.caseId}` : 'Lokasi tidak diketahui'}
                        </p>
                        {doc.folderLabel && (
                          <p className="text-xs text-muted-foreground truncate">
                            {doc.folderLabel}
                          </p>
                        )}
                      </td>
                      <td className="text-right text-xs text-muted-foreground">
                        {(doc.size / 1024).toFixed(1)} KB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTemplateView = () => {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Perpustakaan Template (Templates Library)</p>
            <p className="text-xs text-muted-foreground">
              Master draft akta dan daftar dokumen persyaratan yang bisa dipakai ulang oleh staf.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link href="/document-templates" className="gap-1.5">
              <FileText className="size-3.5" />
              Buat Template Baru
            </Link>
          </Button>
        </div>

        {loadingTemplates ? (
          <p className="text-xs text-muted-foreground">Memuat daftar template...</p>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Library className="size-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Belum ada template dokumen persyaratan.</p>
              <p className="text-xs text-muted-foreground">
                Buat template per jenis pekerjaan agar staf selalu memakai daftar dokumen yang sama.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-sm hover:border-primary/70 hover:shadow-md transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{tpl.name}</p>
                    <Badge variant="secondary" appearance="light" size="xs">
                      {tpl.category === 'ppat' ? 'PPAT' : 'Notaris'}
                    </Badge>
                  </div>
                  {tpl.jenis_pekerjaan && (
                    <p className="text-[0.7rem] text-muted-foreground">
                      Jenis pekerjaan: {tpl.jenis_pekerjaan}
                    </p>
                  )}
                  {tpl.description && (
                    <p className="text-[0.7rem] text-muted-foreground line-clamp-2">
                      {tpl.description}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[0.7rem] text-muted-foreground">
                    {tpl.items?.length ?? 0} dokumen syarat
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/document-templates" className="gap-1">
                      <FileText className="size-3" />
                      Buka detail
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderOutputArchive = () => {
    const visible = outputDocs;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Dokumen Keluar (Output Archive)</p>
            <p className="text-xs text-muted-foreground">
              Minuta dan salinan akta yang sudah selesai, dilengkapi metadata lokasi fisik jika ada.
            </p>
          </div>
          <Badge variant="secondary" appearance="light" size="sm">
            {visible.length} dokumen output
          </Badge>
        </div>

        {loadingProtocol && (
          <p className="text-[0.7rem] text-muted-foreground">
            Memuat metadata protokol digital...
          </p>
        )}

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Archive className="size-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Belum ada minuta/salinan yang terdeteksi.</p>
              <p className="text-xs text-muted-foreground">
                Penandaan berdasarkan nama atau path file yang mengandung kata &quot;minuta&quot; atau
                &quot;salinan&quot;.
              </p>
            </div>
          </div>
        ) : (
          <div className="kt-card-table">
            <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
              <table className="kt-table w-full align-middle">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Akta Digital</span>
                      </span>
                    </th>
                    <th scope="col">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Metadata Protokol</span>
                      </span>
                    </th>
                    <th scope="col" className="text-right w-24">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Ukuran</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((doc) => {
                    const protocol = protocolByKey.get(doc.key);
                    return (
                      <tr
                        key={doc.key}
                        onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                        className="cursor-pointer hover:bg-muted/60"
                        role="button"
                      >
                        <td>
                          <p className="truncate text-sm font-medium">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.uploaded_at).toLocaleString('id-ID')}
                          </p>
                        </td>
                        <td>
                          {protocol ? (
                            <>
                              <p className="truncate text-sm">
                                Repertorium {protocol.repertorium_number} • Tahun {protocol.year}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                Lokasi fisik: {protocol.physical_location}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Belum terhubung ke entri protokol digital.
                            </p>
                          )}
                        </td>
                        <td className="text-right text-xs text-muted-foreground">
                          {(doc.size / 1024).toFixed(1)} KB
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderExpiryMonitor = () => {
    const total = identityDocs.length;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Dokumen Kadaluarsa (Expiry Monitor)</p>
            <p className="text-xs text-muted-foreground">
              Mengumpulkan dokumen yang tampak seperti identitas atau surat kuasa untuk membantu
              pengecekan masa berlaku di proses kerja.
            </p>
          </div>
          <Badge
            variant={total > 0 ? 'warning' : 'secondary'}
            appearance="light"
            size="sm"
          >
            <AlertTriangle className="size-3 mr-1" />
            {total} kandidat dokumen identitas
          </Badge>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-[0.7rem] text-warning-foreground">
          <AlertTriangle className="mt-0.5 size-3.5" />
          <p>
            Sistem saat ini belum menyimpan tanggal kadaluarsa dokumen. Daftar di bawah ini
            menandai file yang kemungkinan adalah identitas (KTP, Paspor, Surat Kuasa) berdasarkan
            nama file, sehingga staf dapat melakukan pengecekan manual di berkas terkait.
          </p>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Clock3 className="size-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Belum ada dokumen identitas yang terdeteksi.</p>
              <p className="text-xs text-muted-foreground">
                Unggah KTP, Paspor, atau Surat Kuasa dengan nama file yang jelas agar mudah
                dipantau.
              </p>
            </div>
          </div>
        ) : (
          <div className="kt-card-table">
            <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
              <table className="kt-table w-full align-middle">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Dokumen Identitas</span>
                      </span>
                    </th>
                    <th scope="col">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Lokasi / Catatan</span>
                      </span>
                    </th>
                    <th scope="col" className="text-right w-24">
                      <span className="kt-table-col">
                        <span className="kt-table-col-label">Ukuran</span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {identityDocs.map((doc) => (
                    <tr
                      key={doc.key}
                      onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                      className="cursor-pointer hover:bg-muted/60"
                      role="button"
                    >
                      <td>
                        <p className="truncate text-sm font-medium">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Diunggah:{' '}
                          {new Date(doc.uploaded_at).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </td>
                      <td>
                        <p className="truncate text-sm">
                          {doc.caseId ? `Berkas #${doc.caseId}` : 'Belum terhubung ke berkas tertentu'}
                        </p>
                        <p className="text-xs text-warning-foreground">
                          Periksa masa berlaku langsung di dokumen.
                        </p>
                      </td>
                      <td className="text-right text-xs text-muted-foreground">
                        {(doc.size / 1024).toFixed(1)} KB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SOP_DEFINITIONS = [
    {
      id: 'cek-sertifikat',
      title: 'SOP Pengecekan Sertifikat Tanah',
      category: 'Pertanahan',
      updatedAt: '2025-01-10',
      steps: [
        'Validasi identitas pemohon dan kecocokan data kepemilikan.',
        'Lakukan pencarian sertifikat di BPN sesuai wilayah kerja.',
        'Dokumentasikan hasil cek dalam berita acara internal.',
      ],
      relatedTemplate: 'Template Berita Acara Pengecekan Sertifikat',
    },
    {
      id: 'validasi-pajak',
      title: 'SOP Validasi Pajak Jual Beli',
      category: 'Perpajakan',
      updatedAt: '2025-02-03',
      steps: [
        'Kumpulkan seluruh bukti setor PPh dan BPHTB.',
        'Cocokkan nilai transaksi di akta dengan bukti setor.',
        'Konfirmasi keuangan jika ada selisih atau keterlambatan pembayaran.',
      ],
      relatedTemplate: 'Checklist Validasi Pajak AJB',
    },
    {
      id: 'penulisan-akta',
      title: 'SOP Teknik Penulisan Akta',
      category: 'Notariil',
      updatedAt: '2025-01-22',
      steps: [
        'Gunakan format baku kantor untuk heading, nomor, dan pembukaan.',
        'Pastikan identitas para pihak sudah tervalidasi sebelum draft final.',
        'Lakukan pemeriksaan silang oleh staf senior sebelum penandatanganan.',
      ],
      relatedTemplate: 'Template Draft Akta Standar',
    },
  ] as const;

  const renderSOPView = () => {
    const categories = Array.from(new Set(SOP_DEFINITIONS.map((s) => s.category)));

    return (
      <div className="grid gap-6 lg:grid-cols-[220px,minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kategori SOP
          </p>
          <div className="space-y-1">
            {categories.map((cat) => (
              <div
                key={cat}
                className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs"
              >
                <ScrollText className="size-3.5 text-muted-foreground" />
                <span>{cat}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.7rem] text-muted-foreground">
            Menu ini dapat dikembangkan menjadi modul penuh dengan manajemen versi dan approval
            dari Notaris.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">SOP Kantor</p>
            <p className="text-xs text-muted-foreground">
              &quot;Buku pintar&quot; digital untuk memastikan seluruh staf mengikuti standar kerja
              yang sama, mulai dari pengecekan sertifikat hingga teknik penulisan akta.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {SOP_DEFINITIONS.map((sop) => (
              <div
                key={sop.id}
                className="flex flex-col justify-between rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/70 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{sop.title}</p>
                    <Badge variant="info" appearance="light" size="xs">
                      {sop.category}
                    </Badge>
                  </div>
                  <p className="text-[0.7rem] text-muted-foreground">
                    Revisi terakhir: {new Date(sop.updatedAt).toLocaleDateString('id-ID')}
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-[0.7rem] text-muted-foreground">
                    {sop.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[0.7rem] text-muted-foreground">
                    Dokumen terkait: {sop.relatedTemplate}
                  </p>
                  <Button size="sm" variant="outline">
                    Download form terkait
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <p className="text-sm text-muted-foreground">Memuat repositori dokumen kantor...</p>
      );
    }

    if (documents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <FolderOpen className="size-10 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Belum ada dokumen yang ditampilkan.</p>
            <p className="text-xs text-muted-foreground">
              Gunakan tombol &quot;Upload Dokumen&quot; untuk mulai mengunggah berkas ke
              penyimpanan dokumen.
            </p>
          </div>
        </div>
      );
    }

    switch (activeMenu) {
      case 'client':
        return renderClientDocuments();
      case 'templates':
        return renderTemplateView();
      case 'output':
        return renderOutputArchive();
      case 'expiry':
        return renderExpiryMonitor();
      case 'sop':
        return renderSOPView();
      case 'dashboard':
      default:
        return renderDashboard();
    }
  };

  const menuItems: { key: MenuKey; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      key: 'dashboard',
      label: 'Dashboard Utama',
      icon: <LayoutDashboard className="size-3.5" />,
    },
    {
      key: 'client',
      label: 'Dokumen Berkas',
      icon: <FolderOpen className="size-3.5" />,
      badge: (stats?.client_count ?? clientDocs.length) ? String(stats?.client_count ?? clientDocs.length) : undefined,
    },
    {
      key: 'templates',
      label: 'Template Akta',
      icon: <Library className="size-3.5" />,
      badge: templates.length ? templates.length.toString() : undefined,
    },
    {
      key: 'output',
      label: 'Dokumen Keluar',
      icon: <Archive className="size-3.5" />,
      badge: (stats?.output_count ?? outputDocs.length) ? String(stats?.output_count ?? outputDocs.length) : undefined,
    },
    {
      key: 'expiry',
      label: 'Expiry Monitor',
      icon: <Clock3 className="size-3.5" />,
      badge: (stats?.identity_count ?? identityDocs.length) ? String(stats?.identity_count ?? identityDocs.length) : undefined,
    },
    {
      key: 'sop',
      label: 'SOP Kantor',
      icon: <ScrollText className="size-3.5" />,
    },
  ];

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title={
            <span className="inline-flex items-center gap-2">
              <FolderOpen className="size-5" />
              <span>Pusat Dokumen & Arsip</span>
            </span>
          }
          description="Global view seluruh dokumen digital kantor: berkas klien, template, minuta, dan SOP operasional."
        />
        <ToolbarActions>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/document-templates" className="gap-2">
                <FileText className="size-4" />
                Template Dokumen
              </Link>
            </Button>
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
              getDocumentsStatsApi(token).then(setStats).catch(() => {});
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
          <div className="kt-card flex flex-col">
            <div
              className="kt-card-body flex flex-col gap-6 p-6"
              style={{
                flexDirection: isDesktop ? 'row' : 'column',
              }}
            >
              <aside
                className={`flex flex-shrink-0 flex-col space-y-4 border-b border-border pb-6 ${isDesktop ? '' : 'w-full'}`}
                style={
                  isDesktop
                    ? {
                        width: 250,
                        borderBottom: 'none',
                        paddingBottom: 0,
                        borderRight: '1px solid var(--border)',
                        paddingRight: 24,
                      }
                    : undefined
                }
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Menu Dokumen
                  </p>
                </div>
                <nav className="space-y-1">
                  {menuItems.map((item) => {
                    const isActive = activeMenu === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveMenu(item.key)}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs ${isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/80'
                          }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`flex size-5 items-center justify-center rounded-md ${isActive ? 'bg-primary-foreground/20' : 'bg-background'
                              }`}
                          >
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </span>
                        {item.badge && (
                          <Badge
                            variant="secondary"
                            appearance="light"
                            size="xs"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </nav>

                <div className="mt-4 space-y-1 text-[0.7rem] text-muted-foreground">
                  <p className="font-medium">Tips penggunaan:</p>
                  <ul className="space-y-0.5 list-disc pl-4">
                    <li>Ketik kata kunci di global search untuk memfilter semua menu.</li>
                    <li>Pakai Dokumen Berkas untuk verifikasi lintas berkas.</li>
                    <li>Arsip Selesai membantu mencari minuta lama dengan cepat.</li>
                  </ul>
                </div>
              </aside>

              <section className="min-w-0 flex-1 space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 shrink-0 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama file atau folder..."
                    className="h-10 w-full max-w-md pl-10 pr-10"
                    aria-label="Global search dokumen"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Hapus pencarian"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {isSearchActive && activeMenu !== 'dashboard' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">
                      Global search: <strong className="text-foreground">{filteredDocuments.length}</strong> hasil untuk &quot;<strong className="text-foreground">{search.trim()}</strong>&quot;
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSearch('')}
                    >
                      Hapus filter
                    </Button>
                  </div>
                )}
                {renderContent()}
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


