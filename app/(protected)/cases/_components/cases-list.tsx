'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useRouter } from 'next/navigation';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import {
  createCaseApi,
  getWorkflowTemplatesApi,
  getJenisPekerjaanApi,
  type CreateCaseBody,
  type CaseCategory,
  type WorkflowTemplateItem,
  type JenisPekerjaanResponse,
} from '@/lib/api';
import { CreatePPATCaseDialog } from './create-ppat-case-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Eye, Search, CalendarDays } from 'lucide-react';
import { KTDataTable } from '@keenthemes/ktui';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

/** Komponen React untuk tombol aksi "Detail" — pakai router.push agar client-side navigation */
function CaseRowAction({
  caseId,
  router,
}: {
  caseId: string;
  router: { push: (href: string) => void };
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title="Detail"
      aria-label="Detail"
      onClick={() => router.push(`/cases/${caseId}`)}
    >
      <Eye className="size-4" />
    </Button>
  );
}

const CASE_STATUSES = ['drafting', 'signed', 'registered', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = {
  drafting: 'Drafting',
  signed: 'Tanda tangan',
  registered: 'Terdaftar',
  closed: 'Arsip',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  drafting: 'kt-badge kt-badge-info',
  signed: 'kt-badge kt-badge-warning',
  registered: 'kt-badge kt-badge-success',
  closed: 'kt-badge kt-badge-secondary',
};

export function CasesList({
  category,
  title,
}: {
  category: CaseCategory;
  title: string;
}) {
  const { token } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const datatableRef = useRef<InstanceType<typeof KTDataTable> | null>(null);
  const actionRootsRef = useRef<Set<Root>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateFrom = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const dateTo = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';

  const filterRef = useRef({ category, statusFilter, dateFrom, dateTo });
  filterRef.current = { category, statusFilter, dateFrom, dateTo };

  useEffect(() => {
    if (!token || !containerRef.current) return;

    const el = containerRef.current;
    const roots = actionRootsRef.current;

    const unmountActionRoots = () => {
      roots.forEach((root) => {
        try {
          root.unmount();
        } catch (_) {}
      });
      roots.clear();
    };

    const existing = (KTDataTable as unknown as { getInstance: (el: HTMLElement) => InstanceType<typeof KTDataTable> | null }).getInstance?.(el);
    if (existing) {
      unmountActionRoots();
      existing.dispose();
      datatableRef.current = null;
    }

    const params = new URLSearchParams();
    params.set('category', category);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const apiEndpoint = `/api/cases?${params.toString()}`;

    new KTDataTable(el, {
      apiEndpoint,
      requestMethod: 'GET',
      requestHeaders: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      pageSize: 20,
      pageSizes: [10, 20, 50],
      stateSave: true,
      search: { delay: 400 },
      infoEmpty: 'Belum ada berkas. Klik "Tambah Berkas" untuk membuat.',
      info: '{start}-{end} dari {total}',
      mapRequest: (query: URLSearchParams) => {
        const f = filterRef.current;
        query.set('category', f.category);
        if (f.statusFilter) query.set('status', f.statusFilter);
        if (f.dateFrom) query.set('date_from', f.dateFrom);
        if (f.dateTo) query.set('date_to', f.dateTo);
        return query;
      },
      mapResponse: (res: { data?: unknown[]; totalCount?: number }) => ({
        data: res.data ?? [],
        totalCount: res.totalCount ?? 0,
      }),
      columns: {
        nama_para_pihak: {
          render: (value) => {
            const v = value ?? '';
            return `<span class="max-w-[200px] truncate block">${escapeHtml(String(v)) || '-'}</span>`;
          },
        },
        jenis_akta: {
          render: (value) => `<span class="font-medium">${escapeHtml(String(value ?? '')) || '-'}</span>`,
        },
        current_task_name: {
          render: (value) => escapeHtml(String(value ?? '')) || '-',
        },
        pic_name: {
          render: (value) => escapeHtml(String(value ?? '')) || '-',
        },
        created_at: {
          render: (value) => {
            if (!value) return '-';
            try {
              const d = new Date(String(value));
              return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch {
              return '-';
            }
          },
        },
        status: {
          render: (value) => {
            const s = String(value ?? '');
            const label = STATUS_LABELS[s] ?? s;
            const cls = STATUS_BADGE_CLASS[s] ?? 'kt-badge';
            return `<span class="${cls}">${escapeHtml(label)}</span>`;
          },
        },
        actions: {
          render: () => '',
          createdCell: (cell, _cellData, rowData: { id?: string }) => {
            cell.innerHTML = '';
            const caseId = rowData?.id ?? '';
            const root = createRoot(cell);
            root.render(<CaseRowAction caseId={caseId} router={router} />);
            roots.add(root);
          },
        },
      },
    });

    const dt = (KTDataTable as unknown as { getInstance: (el: HTMLElement) => InstanceType<typeof KTDataTable> | null }).getInstance?.(el);
    if (!dt) return;

    const drawEventId = dt.on('draw', unmountActionRoots);

    datatableRef.current = dt;
    return () => {
      unmountActionRoots();
      try {
        dt.off('draw', drawEventId);
      } catch (_) {}
      try {
        dt.dispose();
      } catch (_) {}
      datatableRef.current = null;
    };
  }, [token, category, statusFilter, dateFrom, dateTo, router]);

  const handleCreateSuccess = () => {
    setCreateOpen(false);
    if (datatableRef.current) {
      datatableRef.current.reload();
    }
  };

  const tableId = `kt_datatable_cases_${category}`;

  return (
    <>
      <Toolbar>
        <ToolbarHeading title={title} />
        <ToolbarActions>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="me-2 size-4" />
            Tambah Berkas
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="container">
        {error && <p className="mb-4 text-destructive">{error}</p>}

        <div className="grid w-full space-y-5">
          <div className="kt-card">
            <div className="kt-card-header flex flex-row items-center justify-between gap-4 py-4 min-h-14 border-b border-border">
              <div className="relative w-full max-w-sm shrink-0">
                <Search className="pointer-events-none size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari..."
                  className="kt-input h-9 w-full pl-9 pr-3"
                  data-kt-datatable-search={`#${tableId}`}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Semua status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua status</SelectItem>
                    {CASE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 min-w-[200px] justify-start text-left font-normal">
                      <CalendarDays className="size-4 shrink-0 opacity-60" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <span>
                            {format(dateRange.from, 'd MMM yyyy', { locale: id })} – {format(dateRange.to, 'd MMM yyyy', { locale: id })}
                          </span>
                        ) : (
                          format(dateRange.from, 'd MMM yyyy', { locale: id })
                        )
                      ) : (
                        <span className="text-muted-foreground">Tanggal input</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={id}
                    />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 text-muted-foreground"
                    onClick={() => setDateRange(undefined)}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
            <div
              key={`table-${category}-${statusFilter}-${dateFrom}-${dateTo}`}
              ref={containerRef}
              id={tableId}
              className="kt-card-table"
            >
              <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
                <table className="kt-table" data-kt-datatable-table="true">
                  <thead>
                    <tr>
                      <th scope="col" className="w-[200px]" data-kt-datatable-column="nama_para_pihak">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Nama klien</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-40" data-kt-datatable-column="jenis_akta">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Jenis akta</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-44" data-kt-datatable-column="current_task_name">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Tahapan saat ini</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-32" data-kt-datatable-column="pic_name">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">PIC</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-28" data-kt-datatable-column="created_at">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Tanggal input</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-28" data-kt-datatable-column="status">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Status</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-20" data-kt-datatable-column="actions" />
                    </tr>
                  </thead>
                  <tbody />
                </table>
              </div>
              <div className="kt-datatable-toolbar">
                <div className="kt-datatable-length">
                  Tampilkan
                  <select
                    className="kt-select kt-select-sm w-16"
                    name="perpage"
                    data-kt-datatable-size="true"
                  />
                  per halaman
                </div>
                <div className="kt-datatable-info">
                  <span data-kt-datatable-info="true" />
                  <div className="kt-datatable-pagination" data-kt-datatable-pagination="true" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {category === 'ppat' ? (
        <CreatePPATCaseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          token={token}
          onSuccess={handleCreateSuccess}
        />
      ) : (
        <CreateCaseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          category={category}
          token={token}
          onSuccess={handleCreateSuccess}
        />
      )}
    </>
  );
}

function escapeHtml(s: string): string {
  if (typeof document === 'undefined') return s;
  const el = document.createElement('div');
  el.textContent = s;
  return el.innerHTML;
}

function CreateCaseDialog({
  open,
  onOpenChange,
  category,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CaseCategory;
  token: string | null;
  onSuccess: () => void;
}) {
  const [jenisPekerjaanId, setJenisPekerjaanId] = useState('');
  const [jenisPekerjaanList, setJenisPekerjaanList] = useState<JenisPekerjaanResponse[]>([]);
  const [nomorDraft, setNomorDraft] = useState('');
  const [namaParaPihak, setNamaParaPihak] = useState('');
  const [status, setStatus] = useState<string>('drafting');
  const [taskNamesText, setTaskNamesText] = useState('');
  const [workflowTemplateId, setWorkflowTemplateId] = useState('');
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && token) {
      getWorkflowTemplatesApi(token, { category }).then(setTemplates).catch(() => setTemplates([]));
      getJenisPekerjaanApi(token, { category }).then((list) => setJenisPekerjaanList(list.filter((j) => j.active))).catch(() => setJenisPekerjaanList([]));
    }
  }, [open, token, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selected = jenisPekerjaanList.find((j) => j.id === jenisPekerjaanId);
    if (!selected) {
      setErr('Pilih jenis akta / jenis pekerjaan.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const task_names = taskNamesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const body: CreateCaseBody = {
        category,
        jenis_akta: selected.name,
        nomor_draft: nomorDraft.trim() || undefined,
        nama_para_pihak: namaParaPihak.trim() || undefined,
        status: status as CreateCaseBody['status'],
        task_names: task_names.length > 0 ? task_names : undefined,
        workflow_template_id: workflowTemplateId.trim() || undefined,
      };
      if (category === 'ppat') body.jenis_pekerjaan_ppat = selected.id;
      await createCaseApi(token, body);
      setJenisPekerjaanId('');
      setNomorDraft('');
      setNamaParaPihak('');
      setStatus('drafting');
      setTaskNamesText('');
      setWorkflowTemplateId('');
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan berkas');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Berkas Akta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <p className="text-sm text-muted-foreground">
              Kategori: {category === 'notaris' ? 'Notaris' : 'PPAT'}
            </p>
            <div className="space-y-2">
              <Label>Jenis akta / jenis pekerjaan *</Label>
              <Select value={jenisPekerjaanId} onValueChange={setJenisPekerjaanId} required>
                <SelectTrigger id="jenis_akta">
                  <SelectValue placeholder={category === 'ppat' ? 'Pilih jenis pekerjaan (PPAT)' : 'Pilih jenis pekerjaan (Notaris)'} />
                </SelectTrigger>
                <SelectContent>
                  {jenisPekerjaanList.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name}
                      {j.biaya != null ? ` — Rp ${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(j.biaya)}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nomor_draft">Nomor draft</Label>
              <Input
                id="nomor_draft"
                value={nomorDraft}
                onChange={(e) => setNomorDraft(e.target.value)}
                placeholder="Opsional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama_para_pihak">Nama para pihak</Label>
              <Input
                id="nama_para_pihak"
                value={namaParaPihak}
                onChange={(e) => setNamaParaPihak(e.target.value)}
                placeholder="Ringkasan pihak-pihak"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template workflow (opsional)</Label>
              <Select value={workflowTemplateId || '_none'} onValueChange={(v) => setWorkflowTemplateId(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tanpa template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Tanpa template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.jenis_pekerjaan ? `(${t.jenis_pekerjaan})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task_names">Tahapan (opsional, satu per baris)</Label>
              <textarea
                id="task_names"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={taskNamesText}
                onChange={(e) => setTaskNamesText(e.target.value)}
                placeholder="Terima dokumen&#10;Draft akta&#10;Tanda tangan&#10;Arsip minuta"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
