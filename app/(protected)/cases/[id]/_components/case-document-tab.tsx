'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
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
  { id: 'lainnya', name: 'Lainnya', category: 'REPOSITORI' },
];

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
}

type RequirementType = { id: string; name: string; category: string };

export function CaseDocumentTab({ caseId, token, picName = '-', userRole, currentUserName }: CaseDocumentTabProps) {
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const entryByItem = entriesByItemKey(documentEntries);
  const verifiedCount = requirementTypes.filter((r) => entryByItem[r.id]?.verification_status === 'verified').length;
  const totalRequirementCount = requirementTypes.length;

  const openUpload = () => {
    setUploadStep(1);
    setUploadFile(null);
    setUploadDocType(requirementTypes[0]?.id ?? REPOSITORI_TYPE_OPTIONS[0]?.id ?? '');
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
  }

  const handleUploadSubmit = async () => {
    if (!token || !caseId || !uploadFile) return;
    const isPersyaratan = requirementTypes.some((r) => r.id === uploadDocType);
    const folder = isPersyaratan
      ? `cases/${caseId}/persyaratan/${uploadDocType}`
      : `cases/${caseId}/repositori`;
    setUploadSubmitting(true);
    setUploadErr(null);
    try {
      const uploaded = await uploadDocumentApi(token, uploadFile, { folder });
      if (isPersyaratan) {
        await createCaseDocumentEntryApi(token, caseId, { item_key: uploadDocType, file_key: uploaded.key });
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

  const filteredRepositori = search.trim()
    ? repositoriDocs.filter((d) =>
        d.file_name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : repositoriDocs;

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
              <Button size="sm" className="ml-auto" onClick={openUpload}>
                <UploadCloud className="me-2 size-4" />
                Unggah Dokumen
              </Button>
            </div>

            {/* Table */}
            {loading ? (
              <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
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
                              <span className="text-muted-foreground text-xs">BELUM ADA</span>
                            ) : isVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                                <CheckCircle2 className="size-3.5" />
                                Terverifikasi
                              </span>
                            ) : isRejected ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
                                <XCircle className="size-3.5" />
                                Ditolak
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
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
                                    ? 'border-success bg-success/10 text-success'
                                    : 'border-border hover:bg-muted',
                                )}
                                title={entry.physical_received ? 'Fisik diterima' : 'Tandai fisik diterima'}
                                aria-label={entry.physical_received ? 'Fisik diterima' : 'Belum diterima'}
                              >
                                {entry.physical_received ? (
                                  <CheckCircle2 className="size-4" />
                                ) : (
                                  <span className="size-4 rounded-sm border-2 border-current opacity-50" />
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
                                  asChild
                                >
                                  <a
                                    href={entry.presign_url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Eye className="size-4" />
                                    Periksa
                                  </a>
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
                                onClick={openUpload}
                                title="Unggah dokumen"
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
          </section>
        )}

        {docSubView === 'repositori' && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold">Repositori Akta</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama dokumen..."
                    className="pl-8 w-48 sm:w-56"
                  />
                </div>
                <Button size="sm" onClick={openUpload}>
                  <UploadCloud className="me-2 size-4" />
                  Unggah
                </Button>
              </div>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Draft akta, minuta, salinan, dan dokumen produk akta lainnya.
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Memuat dokumen...</p>
            ) : filteredRepositori.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <FolderOpen className="size-12 text-muted-foreground" />
                <p className="text-sm font-medium">Belum ada dokumen di repositori.</p>
                <p className="text-xs text-muted-foreground">
                  Klik &quot;Unggah&quot; untuk menambah draft akta atau minuta.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRepositori.map((d) => {
                  const ext = getFileExt(d.file_name);
                  const isPdf = ext === 'PDF';
                  return (
                    <div
                      key={d.key}
                      className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-4 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div
                        className={cn(
                          'flex size-12 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white',
                          isPdf ? 'bg-orange-500' : 'bg-primary',
                        )}
                      >
                        {ext}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.file_name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          v1.0 · {new Date(d.uploaded_at).toLocaleDateString('id-ID')}
                        </p>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          download
                          className="mt-2 inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                          title="Unduh"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="size-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Upload modal */}
      <Dialog open={uploadOpen} onOpenChange={(open) => !open && closeUpload()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unggah Dokumen Baru</DialogTitle>
          </DialogHeader>
          <DialogBody className="gap-4">
            {uploadStep === 1 && (
              <>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-10 transition-colors hover:bg-primary/10"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/20">
                    <UploadCloud className="size-7 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Klik atau seret file ke sini
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, JPG, atau PNG (Maks. {MAX_FILE_SIZE_MB}MB)
                  </p>
                </div>
                <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
                  <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Pastikan dokumen terlihat jelas dan tidak terpotong untuk mempermudah verifikasi.
                  </p>
                </div>
              </>
            )}

            {uploadStep === 2 && uploadFile && (
              <>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <FileText className="size-8 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{uploadFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadFile.size / 1024 / 1024).toFixed(2)} MB · SIAP DIUNGGAH
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Pilih Jenis Dokumen</Label>
                  <Select value={uploadDocType} onValueChange={setUploadDocType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Jenis dokumen" />
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
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={uploadPhysical}
                    onChange={(e) => setUploadPhysical(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Dokumen Fisik Sudah Diterima Kantor</span>
                </label>
                <div className="space-y-2">
                  <Label>Catatan Tambahan</Label>
                  <textarea
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="Contoh: Nama di KTP sedikit berbeda dengan Sertifikat..."
                    className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </>
            )}

            {uploadErr && (
              <p className="text-sm text-destructive">{uploadErr}</p>
            )}
          </DialogBody>
          <DialogFooter>
            {uploadStep === 2 ? (
              <>
                <Button type="button" variant="outline" onClick={() => setUploadStep(1)}>
                  Kembali
                </Button>
                <Button
                  type="button"
                  onClick={handleUploadSubmit}
                  disabled={uploadSubmitting}
                >
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
    </div>
  );
}
