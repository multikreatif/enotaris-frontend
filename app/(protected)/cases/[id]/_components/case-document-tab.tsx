'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FolderOpen,
  ShieldCheck,
  UploadCloud,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  AlertCircle,
  Eye,
  XCircle,
  Loader2,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { cn } from '@/lib/utils';
import {
  getDocumentsApi,
  uploadDocumentApi,
  getDocumentRequirementsForCaseApi,
  getCaseDocumentEntriesApi,
  createCaseDocumentEntryApi,
  patchCaseDocumentEntryApi,
  type DocumentItem,
  type DocumentRequirementTemplateItemResponse,
  type CaseDocumentEntryItem,
} from '@/lib/api';
import { DocumentPreviewPanel } from './document-preview-panel';

const MAX_FILE_SIZE_MB = 10;
const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png';

const FALLBACK_REQUIREMENT_TYPES: { id: string; name: string; category: string }[] = [
  { id: 'sertifikat', name: 'Sertifikat Tanah Asli', category: 'UTAMA' },
  { id: 'ktp_penjual', name: 'KTP Penjual (Suami/Istri)', category: 'IDENTITAS' },
  { id: 'pbb', name: 'PBB Tahun Terakhir', category: 'PAJAK' },
  { id: 'npwp', name: 'NPWP', category: 'PAJAK' },
];

const REPOSITORI_TYPE_OPTIONS = [
  { id: 'draft_akta', name: 'Draft Akta', category: 'AKTA' },
  { id: 'minuta', name: 'Minuta', category: 'AKTA' },
  { id: 'salinan', name: 'Salinan', category: 'AKTA' },
  { id: 'lainnya', name: 'Lainnya', category: 'REPOSITORI' },
];

const REPOSITORI_TYPE_IDS = ['draft_akta', 'minuta', 'salinan', 'lainnya'] as const;

/** Mengambil tipe repositori dari object key (path). Key bisa: .../repositori/draft_akta/file.pdf atau .../repositori/file.pdf */
function getRepositoriTypeFromKey(key: string): string {
  const idx = key.indexOf('repositori/');
  if (idx === -1) return 'lainnya';
  const after = key.slice(idx + 'repositori/'.length);
  const seg = after.split('/')[0];
  if (REPOSITORI_TYPE_IDS.includes(seg as (typeof REPOSITORI_TYPE_IDS)[number])) return seg;
  return seg && !seg.includes('.') ? seg : 'lainnya';
}

function getFileExt(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toUpperCase() : 'FILE';
}

export interface CaseDocumentTabProps {
  caseId: string;
  token: string | null;
  picName?: string;
  /** Role name for UI: notaris sees Periksa + verifikasi/tolak; staff can set fisik */
  userRole?: string;
  /** Current user display name (optional) */
  currentUserName?: string;
  /** Nama klien primary untuk penamaan file bundle PDF */
  primaryClientName?: string;
}

type RequirementType = { id: string; name: string; category: string };

export function CaseDocumentTab({ caseId, token, picName = '-', userRole, currentUserName, primaryClientName }: CaseDocumentTabProps) {
  const [docSubView, setDocSubView] = useState<'persyaratan' | 'repositori'>('persyaratan');
  const [requirementItems, setRequirementItems] = useState<DocumentRequirementTemplateItemResponse[]>([]);
  const [documentEntries, setDocumentEntries] = useState<CaseDocumentEntryItem[]>([]);
  const [persyaratanDocs, setPersyaratanDocs] = useState<DocumentItem[]>([]);
  const [repositoriDocs, setRepositoriDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<1 | 2>(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<string>('');
  const [uploadPhysical, setUploadPhysical] = useState(false);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [patchingEntryId, setPatchingEntryId] = useState<string | null>(null);
  const [rejectDialogEntry, setRejectDialogEntry] = useState<CaseDocumentEntryItem | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [inspectEntry, setInspectEntry] = useState<CaseDocumentEntryItem | null>(null);
  const [inspectDocumentName, setInspectDocumentName] = useState('');
  /** Entry IDs selected for bundle PDF download (hanya entry yang punya presign_url). */
  const [selectedForBundle, setSelectedForBundle] = useState<Set<string>>(new Set());
  /** Document keys (d.key) selected for bundle dari Dokumen Lainnya. */
  const [selectedLainnyaForBundle, setSelectedLainnyaForBundle] = useState<Set<string>>(new Set());
  const [bundleDownloading, setBundleDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** Ketika upload dibuka dari baris persyaratan, simpan item_key agar di step 2 jenis dokumen tetap terpilih. */
  const uploadPreselectedKeyRef = useRef<string | undefined>(undefined);
  const isNotaris = userRole?.toLowerCase() === 'notaris';

  const requirementTypes: RequirementType[] = requirementItems.length > 0
    ? requirementItems.map((it) => ({ id: it.item_key, name: it.document_name, category: it.document_category }))
    : FALLBACK_REQUIREMENT_TYPES;

  const documentTypeOptions: RequirementType[] = [...requirementTypes, ...REPOSITORI_TYPE_OPTIONS];

  const entriesByItemKey = useCallback((entries: CaseDocumentEntryItem[]) => {
    const map: Record<string, CaseDocumentEntryItem> = {};
    entries.forEach((e) => { map[e.item_key] = e; });
    return map;
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!token || !caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [reqs, entries, pers, repo] = await Promise.all([
        getDocumentRequirementsForCaseApi(token, caseId),
        getCaseDocumentEntriesApi(token, caseId),
        getDocumentsApi(token, { folder: `cases/${caseId}/persyaratan` }),
        getDocumentsApi(token, { folder: `cases/${caseId}/repositori` }),
      ]);
      setRequirementItems(reqs);
      setDocumentEntries(entries);
      setPersyaratanDocs(pers);
      setRepositoriDocs(repo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dokumen');
      setDocumentEntries([]);
      setPersyaratanDocs([]);
      setRepositoriDocs([]);
    } finally {
      setLoading(false);
    }
  }, [token, caseId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Saat masuk step 2, pastikan uploadDocType ada di documentTypeOptions agar Select menampilkan nilai terpilih.
  useEffect(() => {
    if (uploadOpen && uploadStep === 2 && uploadFile && documentTypeOptions.length > 0) {
      const exists = documentTypeOptions.some((o) => o.id === uploadDocType);
      if (!exists) {
        const fallback = uploadPreselectedKeyRef.current && documentTypeOptions.some((o) => o.id === uploadPreselectedKeyRef.current)
          ? uploadPreselectedKeyRef.current
          : documentTypeOptions[0]?.id ?? '';
        setUploadDocType(fallback);
      }
    }
  }, [uploadOpen, uploadStep, uploadFile, documentTypeOptions, uploadDocType]);

  const entryByItem = entriesByItemKey(documentEntries);
  const verifiedCount = requirementTypes.filter((r) => entryByItem[r.id]?.verification_status === 'verified').length;
  const totalRequirementCount = requirementTypes.length;

  const toggleSelectedForBundle = (entryId: string) => {
    setSelectedForBundle((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const toggleLainnyaForBundle = (docKey: string) => {
    setSelectedLainnyaForBundle((prev) => {
      const next = new Set(prev);
      if (next.has(docKey)) next.delete(docKey);
      else next.add(docKey);
      return next;
    });
  };

  const getExtFromKeyOrName = (keyOrName: string) => {
    const i = keyOrName.lastIndexOf('.');
    return i >= 0 ? keyOrName.slice(i + 1).toLowerCase() : '';
  };

  /** Menambahkan satu file (buffer + ext) ke mergedPdf. */
  const addToMergedPdf = async (
    mergedPdf: Awaited<ReturnType<typeof PDFDocument.create>>,
    buf: ArrayBuffer,
    ext: string
  ) => {
    if (ext === 'pdf') {
      const src = await PDFDocument.load(buf);
      const pages = await mergedPdf.copyPages(src, src.getPageIndices());
      pages.forEach((p) => mergedPdf.addPage(p));
    } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      const page = mergedPdf.addPage();
      const { width, height } = page.getSize();
      if (ext === 'png') {
        const img = await mergedPdf.embedPng(buf);
        const scale = Math.min(width / img.width, height / img.height, 1);
        page.drawImage(img, { x: 0, y: height - img.height * scale, width: img.width * scale, height: img.height * scale });
      } else {
        const img = await mergedPdf.embedJpg(buf);
        const scale = Math.min(width / img.width, height / img.height, 1);
        page.drawImage(img, { x: 0, y: height - img.height * scale, width: img.width * scale, height: img.height * scale });
      }
    }
  };

  /** Unduh dokumen terpilih (persyaratan + dokumen lainnya) sebagai satu bundle PDF. Urutan: persyaratan dulu, lalu lainnya. */
  const handleDownloadBundle = useCallback(async () => {
    const entryIds = new Set(selectedForBundle);
    const entries = requirementTypes
      .map((r) => entryByItem[r.id])
      .filter((e): e is CaseDocumentEntryItem => !!e && entryIds.has(e.id) && !!e.presign_url);
    const lainnyaKeys = new Set(selectedLainnyaForBundle);
    const lainnyaItems = (repositoriByType.lainnya ?? []).filter((d) => lainnyaKeys.has(d.key) && d.url);
    if (entries.length === 0 && lainnyaItems.length === 0) return;
    setBundleDownloading(true);
    try {
      const mergedPdf = await PDFDocument.create();
      for (const entry of entries) {
        const res = await fetch(entry.presign_url);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const ext = getExtFromKeyOrName(entry.file_key);
        await addToMergedPdf(mergedPdf, buf, ext);
      }
      for (const d of lainnyaItems) {
        const res = await fetch(d.url);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const ext = getExtFromKeyOrName(d.file_name);
        await addToMergedPdf(mergedPdf, buf, ext);
      }
      const blob = await mergedPdf.save();
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      const prefix = (primaryClientName ?? '').trim().replace(/[^\p{L}\p{N}\s-_]/gu, '').replace(/\s+/g, '_') || 'Dokumen';
      a.download = `${prefix}-persyaratan-bundle-${caseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal membuat bundle PDF');
    } finally {
      setBundleDownloading(false);
    }
  }, [requirementTypes, entryByItem, selectedForBundle, selectedLainnyaForBundle, repositoriByType, primaryClientName, caseId]);

  /** Open upload dialog. Pass itemKey when triggered from a requirement row so jenis dokumen is pre-selected in step 2. */
  const openUpload = (preselectedItemKey?: string) => {
    setUploadStep(1);
    setUploadFile(null);
    const initialDocType = preselectedItemKey ?? requirementTypes[0]?.id ?? REPOSITORI_TYPE_OPTIONS[0]?.id ?? '';
    setUploadDocType(initialDocType);
    uploadPreselectedKeyRef.current = preselectedItemKey;
    setUploadPhysical(false);
    setUploadNotes('');
    setUploadErr(null);
    setUploadOpen(true);
  };

  const closeUpload = () => {
    setUploadOpen(false);
    setUploadFile(null);
    setUploadStep(1);
    setUploadErr(null);
    uploadPreselectedKeyRef.current = undefined;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
    e.target.value = '';
  };

  function validateAndSetFile(file: File) {
    setUploadErr(null);
    const ext = getFileExt(file.name).toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      setUploadErr('Hanya PDF, JPG, atau PNG.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadErr(`Maksimal ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setUploadFile(file);
    setUploadStep(2);
    // Pastikan jenis dokumen tetap terpilih saat masuk step 2 (dari baris persyaratan).
    if (uploadPreselectedKeyRef.current) {
      setUploadDocType(uploadPreselectedKeyRef.current);
    }
  }

  const handleUploadSubmit = async () => {
    if (!token || !caseId || !uploadFile) return;
    const isPersyaratan = requirementTypes.some((r) => r.id === uploadDocType);
    const folder = isPersyaratan
      ? `cases/${caseId}/persyaratan/${uploadDocType}`
      : `cases/${caseId}/repositori/${uploadDocType}`;
    setUploadSubmitting(true);
    setUploadErr(null);
    try {
      const uploaded = await uploadDocumentApi(token, uploadFile, { folder });
      if (isPersyaratan) {
        const createRes = await createCaseDocumentEntryApi(token, caseId, { item_key: uploadDocType, file_key: uploaded.key });
        const createdData = createRes?.data as { id?: string } | undefined;
        if (uploadPhysical && createdData?.id) {
          await patchCaseDocumentEntryApi(token, caseId, createdData.id, { physical_received: true });
        }
        await loadDocuments();
      } else {
        setRepositoriDocs((prev) => [uploaded, ...prev]);
      }
      closeUpload();
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Gagal mengunggah dokumen');
    } finally {
      setUploadSubmitting(false);
    }
  };

  const handlePhysicalToggle = async (entry: CaseDocumentEntryItem) => {
    if (!token || !caseId) return;
    const newVal = !entry.physical_received;
    const message = newVal
      ? 'Tandai dokumen fisik sudah diterima?'
      : 'Batalkan tanda terima dokumen fisik?';
    if (!confirm(message)) return;
    setPatchingEntryId(entry.id);
    try {
      await patchCaseDocumentEntryApi(token, caseId, entry.id, { physical_received: newVal });
      await loadDocuments();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal memperbarui checklist fisik');
    } finally {
      setPatchingEntryId(null);
    }
  };

  const handleVerify = async (entry: CaseDocumentEntryItem) => {
    if (!token || !caseId) return;
    if (!confirm('Tandai dokumen ini sebagai Terverifikasi?')) return;
    setPatchingEntryId(entry.id);
    try {
      await patchCaseDocumentEntryApi(token, caseId, entry.id, { verification_status: 'verified' });
      await loadDocuments();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal memverifikasi');
    } finally {
      setPatchingEntryId(null);
    }
  };

  const openRejectDialog = (entry: CaseDocumentEntryItem) => {
    setRejectDialogEntry(entry);
    setRejectNote(entry.rejection_note ?? '');
    setRejectSubmitting(false);
  };

  const handleRejectSubmit = async () => {
    if (!token || !caseId || !rejectDialogEntry) return;
    setRejectSubmitting(true);
    try {
      await patchCaseDocumentEntryApi(token, caseId, rejectDialogEntry.id, {
        verification_status: 'rejected',
        rejection_note: rejectNote.trim() || undefined,
      });
      setRejectDialogEntry(null);
      setRejectNote('');
      await loadDocuments();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal menolak dokumen');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handlePanelVerify = useCallback(
    async (entry: CaseDocumentEntryItem) => {
      if (!token || !caseId) return;
      setPatchingEntryId(entry.id);
      try {
        await patchCaseDocumentEntryApi(token, caseId, entry.id, { verification_status: 'verified' });
        setInspectEntry(null);
        setInspectDocumentName('');
        await loadDocuments();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Gagal memverifikasi');
      } finally {
        setPatchingEntryId(null);
      }
    },
    [token, caseId, loadDocuments]
  );

  const handlePanelReject = useCallback(
    async (entry: CaseDocumentEntryItem, note: string) => {
      if (!token || !caseId) return;
      setPatchingEntryId(entry.id);
      try {
        await patchCaseDocumentEntryApi(token, caseId, entry.id, {
          verification_status: 'rejected',
          rejection_note: note || undefined,
        });
        setInspectEntry(null);
        setInspectDocumentName('');
        await loadDocuments();
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Gagal menolak dokumen');
      } finally {
        setPatchingEntryId(null);
      }
    },
    [token, caseId, loadDocuments]
  );

  const filteredRepositori = search.trim()
    ? repositoriDocs.filter((d) =>
        d.file_name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : repositoriDocs;

  /** Dokumen repositori dikelompokkan per tipe: draft_akta, minuta, salinan, lainnya */
  const repositoriByType = useMemo(() => {
    const map: Record<string, DocumentItem[]> = { draft_akta: [], minuta: [], salinan: [], lainnya: [] };
    filteredRepositori.forEach((d) => {
      const type = getRepositoriTypeFromKey(d.key);
      if (map[type]) map[type].push(d);
      else map.lainnya.push(d);
    });
    return map;
  }, [filteredRepositori]);

  return (
    <div className="flex gap-6">
      {/* Sidebar: Manajemen File */}
      <nav className="w-52 shrink-0 rounded-xl border border-border bg-card p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Manajemen File
        </p>
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => setDocSubView('persyaratan')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
              docSubView === 'persyaratan'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <ShieldCheck className="size-4 shrink-0" />
            Persyaratan
          </button>
          <button
            type="button"
            onClick={() => setDocSubView('repositori')}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
              docSubView === 'repositori'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <FolderOpen className="size-4 shrink-0" />
            Repositori Akta
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {error && (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        )}

        {docSubView === 'persyaratan' && (
          <section className="rounded-xl border border-border bg-card p-5">
            {/* Progres Verifikasi */}
            <div className="mb-6 flex items-center gap-4">
              <div className="relative flex size-14 shrink-0 items-center justify-center">
                <svg className="size-14 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-muted/30"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-primary"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${totalRequirementCount ? (verifiedCount / totalRequirementCount) * 100 : 0}, 100`}
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-xs font-semibold text-primary">
                  {totalRequirementCount ? Math.round((verifiedCount / totalRequirementCount) * 100) : 0}%
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Progres Verifikasi</p>
                <p className="text-xs text-muted-foreground">
                  {verifiedCount} dari {totalRequirementCount} dokumen tervalidasi
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {(selectedForBundle.size > 0 || selectedLainnyaForBundle.size > 0) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadBundle}
                    disabled={bundleDownloading}
                  >
                    {bundleDownloading ? (
                      <Loader2 className="me-2 size-4 animate-spin" />
                    ) : (
                      <Download className="me-2 size-4" />
                    )}
                    Download (PDF)
                  </Button>
                )}
                <Button size="sm" onClick={openUpload}>
                  <UploadCloud className="me-2 size-4" />
                  Unggah Dokumen
                </Button>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="w-10 pb-3 font-medium text-center">Pilih</th>
                      <th className="pb-3 font-medium">Nama Dokumen</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Fisik</th>
                      <th className="pb-3 font-medium">Pengunggah</th>
                      <th className="pb-3 font-medium text-right">Verifikasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirementTypes.map((req) => {
                      const entry = entryByItem[req.id];
                      const isVerified = entry?.verification_status === 'verified';
                      const isRejected = entry?.verification_status === 'rejected';
                      return (
                        <tr key={req.id} className="border-b border-border/80">
                          <td className="py-3 text-center">
                            {entry?.presign_url ? (
                              <input
                                type="checkbox"
                                checked={selectedForBundle.has(entry.id)}
                                onChange={() => toggleSelectedForBundle(entry.id)}
                                className="size-4 rounded border-border"
                                aria-label={`Pilih ${req.name} untuk bundle PDF`}
                              />
                            ) : (
                              <span className="inline-block size-4" aria-hidden />
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 shrink-0 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{req.name}</p>
                                {entry?.rejection_note && (
                                  <p className="text-xs text-destructive mt-0.5">Koreksi: {entry.rejection_note}</p>
                                )}
                                {!entry?.rejection_note && (
                                  <p className="text-xs text-muted-foreground">{req.category}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            {!entry ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/40 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                BELUM ADA
                              </span>
                            ) : isVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-medium">
                                <CheckCircle2 className="size-3.5" />
                                Terverifikasi
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-700 dark:bg-red-500/20 dark:text-red-400 px-2.5 py-0.5 text-xs font-medium">
                                <XCircle className="size-3.5" />
                                Ditolak
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-2.5 py-0.5 text-xs font-medium">
                                <Clock className="size-3.5" />
                                Menunggu
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            {entry ? (
                              <button
                                type="button"
                                onClick={() => handlePhysicalToggle(entry)}
                                disabled={patchingEntryId === entry.id}
                                className={cn(
                                  'inline-flex items-center justify-center size-8 rounded-md border transition-colors',
                                  entry.physical_received
                                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                    : 'border-border hover:bg-muted',
                                )}
                                title={entry.physical_received ? 'Fisik sudah diterima (klik untuk batalkan)' : 'Tandai fisik diterima'}
                                aria-label={entry.physical_received ? 'Fisik sudah diterima' : 'Belum diterima'}
                              >
                                {entry.physical_received ? (
                                  <CheckCircle2 className="size-5 shrink-0" strokeWidth={2.5} />
                                ) : (
                                  <span className="size-4 rounded-sm border-2 border-muted-foreground/60" aria-hidden />
                                )}
                              </button>
                            ) : (
                              <span className="inline-block size-4 rounded border border-muted-foreground/50" aria-label="Belum ada" />
                            )}
                          </td>
                          <td className="py-3">
                            <span className="text-muted-foreground">{entry?.uploaded_by_name ?? '-'}</span>
                          </td>
                          <td className="py-3 text-right">
                            {entry?.presign_url ? (
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => {
                                    setInspectEntry(entry);
                                    setInspectDocumentName(req.name);
                                  }}
                                >
                                  <Eye className="size-4" />
                                  Periksa
                                </Button>
                                {isNotaris && entry.verification_status === 'pending' && (
                                  <>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      className="gap-1 bg-success hover:bg-success/90"
                                      disabled={patchingEntryId === entry.id}
                                      onClick={() => handleVerify(entry)}
                                    >
                                      <CheckCircle2 className="size-4" />
                                      Verifikasi
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 text-destructive border-destructive/50 hover:bg-destructive/10"
                                      disabled={patchingEntryId === entry.id}
                                      onClick={() => openRejectDialog(entry)}
                                    >
                                      <XCircle className="size-4" />
                                      Tolak
                                    </Button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => openUpload(req.id)}
                                title={`Unggah dokumen: ${req.name}`}
                              >
                                <UploadCloud className="size-4" />
                                Unggah
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Dokumen Lainnya — dipisah dari persyaratan terdefinisi di atas */}
            {(repositoriByType.lainnya?.length ?? 0) > 0 && (
              <div className="mt-8 border-t border-border pt-6">
                <h4 className="mb-1 text-sm font-semibold text-foreground">Dokumen Lainnya</h4>
                <p className="mb-4 text-xs text-muted-foreground">
                  Dokumen tambahan di luar daftar persyaratan yang terdefinisi di atas.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="w-10 pb-3 font-medium text-center">Pilih</th>
                        <th className="pb-3 font-medium">Nama File</th>
                        <th className="pb-3 font-medium">Jenis</th>
                        <th className="pb-3 font-medium">Tanggal Unggah</th>
                        <th className="pb-3 font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(repositoriByType.lainnya ?? []).map((d) => {
                        const ext = getFileExt(d.file_name);
                        const isPdf = ext === 'PDF';
                        const canBundle = ['PDF', 'JPG', 'JPEG', 'PNG'].includes(ext);
                        return (
                          <tr key={d.key} className="border-b border-border/80">
                            <td className="py-3 text-center">
                              {canBundle && d.url ? (
                                <input
                                  type="checkbox"
                                  checked={selectedLainnyaForBundle.has(d.key)}
                                  onChange={() => toggleLainnyaForBundle(d.key)}
                                  className="size-4 rounded border-border"
                                  aria-label={`Pilih ${d.file_name} untuk bundle PDF`}
                                />
                              ) : (
                                <span className="inline-block size-4" aria-hidden />
                              )}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    'flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white',
                                    isPdf ? 'bg-orange-500' : 'bg-primary',
                                  )}
                                >
                                  {ext}
                                </div>
                                <p className="truncate font-medium max-w-[240px] sm:max-w-none">{d.file_name}</p>
                              </div>
                            </td>
                            <td className="py-3 text-muted-foreground">{ext}</td>
                            <td className="py-3 text-muted-foreground">
                              {new Date(d.uploaded_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 text-right">
                              <a
                                href={d.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                download
                                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-primary"
                                title="Unduh"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="size-4" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {docSubView === 'repositori' && (
          <section className="rounded-xl border border-border bg-card p-5">
            {/* Bar atas: judul + deskripsi kiri, cari + tombol unggah kanan (mengikuti layout Persyaratan) */}
            <div className="mb-6 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">Repositori Akta</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Draft akta, minuta, salinan, dan dokumen produk akta lainnya.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama dokumen..."
                    className="h-9 w-44 pl-8 sm:w-52"
                  />
                </div>
                <Button size="sm" onClick={openUpload} className="gap-2">
                  <UploadCloud className="size-4" />
                  Unggah Dokumen
                </Button>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
            ) : filteredRepositori.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
                <FolderOpen className="size-12 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Belum ada dokumen di repositori.</p>
                <p className="text-xs text-muted-foreground">
                  Gunakan tombol &quot;Unggah Dokumen&quot; di atas. Pilih jenis: Draft Akta, Minuta, atau Salinan.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {(['draft_akta', 'minuta', 'salinan'] as const).map((typeKey) => {
                  const list = repositoriByType[typeKey] ?? [];
                  const label = typeKey === 'draft_akta' ? 'Draft Akta' : typeKey === 'minuta' ? 'Minuta' : typeKey === 'salinan' ? 'Salinan' : 'Lainnya';
                  return (
                    <div key={typeKey}>
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                        {list.length > 0 && (
                          <span className="ml-2 font-normal normal-case text-foreground">
                            ({list.length})
                          </span>
                        )}
                      </h4>
                      {list.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border bg-muted/10 py-6 text-center text-sm text-muted-foreground">
                          Belum ada dokumen {label.toLowerCase()}.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="pb-3 font-medium">Nama File</th>
                                <th className="pb-3 font-medium">Jenis</th>
                                <th className="pb-3 font-medium">Tanggal Unggah</th>
                                <th className="pb-3 font-medium text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((d) => {
                                const ext = getFileExt(d.file_name);
                                const isPdf = ext === 'PDF';
                                return (
                                  <tr key={d.key} className="border-b border-border/80">
                                    <td className="py-3">
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={cn(
                                            'flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white',
                                            isPdf ? 'bg-orange-500' : 'bg-primary',
                                          )}
                                        >
                                          {ext}
                                        </div>
                                        <p className="truncate font-medium max-w-[240px] sm:max-w-none">{d.file_name}</p>
                                      </div>
                                    </td>
                                    <td className="py-3 text-muted-foreground">{ext}</td>
                                    <td className="py-3 text-muted-foreground">
                                      {new Date(d.uploaded_at).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </td>
                                    <td className="py-3 text-right">
                                      <a
                                        href={d.url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        download
                                        className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-primary"
                                        title="Unduh"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Download className="size-4" />
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Upload modal - tata letak Metronic */}
      <Dialog open={uploadOpen} onOpenChange={(open) => !open && closeUpload()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Unggah Dokumen Baru</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-5">
            {uploadStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Pilih File
                  </Label>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 py-10 transition-colors hover:border-primary/50 hover:bg-muted/30"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_TYPES}
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <div className="flex size-12 items-center justify-center rounded-full bg-primary/15">
                      <UploadCloud className="size-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Klik atau seret file ke sini</p>
                    <p className="text-xs text-muted-foreground">
                      PDF, JPG, atau PNG (maks. {MAX_FILE_SIZE_MB} MB)
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
                  <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Pastikan dokumen terlihat jelas dan tidak terpotong untuk mempermudah verifikasi.
                  </p>
                </div>
              </>
            )}

            {uploadStep === 2 && uploadFile && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-1">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      File Dipilih
                    </Label>
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <FileText className="size-8 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{uploadFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(uploadFile.size / 1024 / 1024).toFixed(2)} MB · siap diunggah
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-doc-type" className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Jenis Dokumen
                    </Label>
                    <Select value={uploadDocType} onValueChange={setUploadDocType}>
                      <SelectTrigger id="upload-doc-type">
                        <SelectValue placeholder="Pilih jenis dokumen" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypeOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Status Fisik
                    </Label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 hover:bg-muted/30">
                      <input
                        type="checkbox"
                        checked={uploadPhysical}
                        onChange={(e) => setUploadPhysical(e.target.checked)}
                        className="size-4 rounded border-input"
                      />
                      <span className="text-sm text-foreground">Dokumen fisik sudah diterima kantor</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upload-notes" className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Catatan Tambahan (opsional)
                    </Label>
                    <textarea
                      id="upload-notes"
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder="Contoh: Nama di KTP sedikit berbeda dengan Sertifikat..."
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              </div>
            )}

            {uploadErr && (
              <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">{uploadErr}</p>
            )}
          </DialogBody>
          <DialogFooter className="gap-2 border-t border-border pt-4">
            {uploadStep === 2 ? (
              <>
                <Button type="button" variant="outline" onClick={() => setUploadStep(1)}>
                  Kembali
                </Button>
                <Button type="button" onClick={handleUploadSubmit} disabled={uploadSubmitting}>
                  {uploadSubmitting ? 'Mengunggah...' : 'Simpan Dokumen'}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={closeUpload}>
                Batal
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tolak (Notaris) */}
      <Dialog open={!!rejectDialogEntry} onOpenChange={(open) => !open && setRejectDialogEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Dokumen</DialogTitle>
          </DialogHeader>
          <DialogBody className="gap-4">
            <p className="text-sm text-muted-foreground">
              Beri alasan penolakan (opsional). Contoh: &quot;File buram, tolong scan ulang&quot;.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reject_note">Catatan koreksi</Label>
              <textarea
                id="reject_note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Koreksi: File buram, tolong scan ulang"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectDialogEntry(null)} disabled={rejectSubmitting}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={handleRejectSubmit} disabled={rejectSubmitting}>
              {rejectSubmitting ? 'Mengirim...' : 'Tolak Dokumen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Panel Periksa: preview dokumen + Panel Verifikasi (Syncfusion PDF viewer untuk PDF) */}
      {inspectEntry && (
        <DocumentPreviewPanel
          open={!!inspectEntry}
          onOpenChange={(open) => !open && setInspectEntry(null)}
          documentName={inspectDocumentName}
          entry={inspectEntry}
          isNotaris={!!isNotaris}
          onVerify={handlePanelVerify}
          onReject={handlePanelReject}
          patchingEntryId={patchingEntryId}
        />
      )}
    </div>
  );
}
