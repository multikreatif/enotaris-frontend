'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createRoot, type Root } from 'react-dom/client';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import {
  getCasesApi,
  getUsersApi,
  createTaskApi,
} from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Workflow, Search, CalendarDays, Eye } from 'lucide-react';
import { KTDataTable } from '@keenthemes/ktui';
import { format, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

const TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked', 'waiting'] as const;
const STATUS_LABELS: Record<string, string> = {
  todo: 'Belum',
  in_progress: 'Proses',
  done: 'Selesai',
  blocked: 'Terhambat',
  waiting: 'Menunggu task sebelumnya',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  todo: 'kt-badge kt-badge-info',
  in_progress: 'kt-badge kt-badge-warning',
  done: 'kt-badge kt-badge-success',
  blocked: 'kt-badge kt-badge-danger',
  waiting: 'kt-badge kt-badge-secondary',
};

function escapeHtml(s: string): string {
  if (typeof document === 'undefined') return s;
  const el = document.createElement('div');
  el.textContent = s;
  return el.innerHTML;
}

/** True jika task punya due_date yang sudah lewat dan status belum selesai (bukan done). */
function isTaskOverdue(rowData: Record<string, unknown>): boolean {
  const status = String(rowData?.status ?? '').toLowerCase();
  if (status === 'done') return false;
  const dueStr = String(rowData?.due_date ?? '').trim();
  if (!dueStr) return false;
  const today = format(new Date(), 'yyyy-MM-dd');
  return dueStr < today;
}

/** Tombol aksi baris: Buka berkas (link ke detail case) — pakai icon standar */
function TaskRowAction({ caseId }: { caseId: string }) {
  return (
    <Button variant="ghost" size="icon" title="Buka berkas" aria-label="Buka berkas" asChild>
      <Link href={`/cases/${caseId}`}>
        <Eye className="size-4" />
      </Link>
    </Button>
  );
}

const OVERDUE_STATUSES = 'todo,in_progress,blocked,waiting';

function yesterdayISO(): string {
  return format(subDays(new Date(), 1), 'yyyy-MM-dd');
}

export default function TasksPage() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const datatableRef = useRef<InstanceType<typeof KTDataTable> | null>(null);
  const actionRootsRef = useRef<Set<Root>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAppliedOverdueFromUrl = useRef(false);
  useEffect(() => {
    if (hasAppliedOverdueFromUrl.current) return;
    if (searchParams.get('overdue') === '1') {
      hasAppliedOverdueFromUrl.current = true;
      setStatusFilter('overdue');
      const yesterday = subDays(new Date(), 1);
      setDateRange({ from: undefined, to: yesterday });
    }
  }, [searchParams]);

  const dateFrom = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const dateTo = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';

  const isOverdueFilter = statusFilter === 'overdue';
  const effectiveDateTo = isOverdueFilter ? (dateTo || yesterdayISO()) : dateTo;
  const effectiveStatusParam = isOverdueFilter ? OVERDUE_STATUSES : statusFilter;

  const filterRef = useRef({ statusFilter, dateFrom, dateTo, effectiveDateTo, effectiveStatusParam: '' });
  filterRef.current = { statusFilter, dateFrom, dateTo, effectiveDateTo, effectiveStatusParam };

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
    if (effectiveStatusParam) params.set('status', effectiveStatusParam);
    if (dateFrom) params.set('due_from', dateFrom);
    if (effectiveDateTo) params.set('due_to', effectiveDateTo);
    const apiEndpoint = `/api/tasks?${params.toString()}`;

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
      infoEmpty: user?.role_name === 'staff' ? 'Tidak ada task yang ditugaskan ke Anda.' : 'Belum ada task.',
      info: '{start}-{end} dari {total}',
      mapRequest: (query: URLSearchParams) => {
        const f = filterRef.current;
        if (f.effectiveStatusParam) query.set('status', f.effectiveStatusParam);
        if (f.dateFrom) query.set('due_from', f.dateFrom);
        if (f.effectiveDateTo) query.set('due_to', f.effectiveDateTo);
        return query;
      },
      mapResponse: (res: { data?: unknown[]; totalCount?: number }) => ({
        data: res.data ?? [],
        totalCount: res.totalCount ?? 0,
      }),
      columns: {
        case_nama_para_pihak: {
          render: (value: unknown, rowData?: Record<string, unknown>) => {
            const caseId = (rowData?.case_id ?? '') as string;
            const nama = String(value ?? '').trim();
            const nomor = String(rowData?.case_nomor_draft ?? '').trim();
            const jenis = String(rowData?.case_jenis_akta ?? '').trim();
            const text = nama
              ? (nomor ? `${nama} (${nomor})` : nama)
              : (nomor ? nomor : jenis ? jenis : '-');
            if (caseId) {
              return `<a href="/cases/${caseId}" class="text-primary hover:underline font-medium">${escapeHtml(text)}</a>`;
            }
            return escapeHtml(text) || '-';
          },
          createdCell: (cell, _cellData, rowData: Record<string, unknown>) => {
            const row = cell.closest?.('tr') ?? (cell as HTMLElement).parentElement?.parentElement;
            if (row && isTaskOverdue(rowData)) {
              (row as HTMLElement).classList.add('!bg-destructive/15', 'border-l-4', 'border-l-destructive');
            }
          },
        },
        nama_task: {
          render: (value) => `<span class="font-medium">${escapeHtml(String(value ?? '')) || '-'}</span>`,
        },
        assigned_to_name: {
          render: (value) => {
            const v = String(value ?? '').trim();
            return v ? `<span class="text-muted-foreground">${escapeHtml(v)}</span>` : '<span class="text-muted-foreground">—</span>';
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
        due_date: {
          render: (value) => (value ? escapeHtml(String(value)) : '<span class="text-muted-foreground">—</span>'),
        },
        actions: {
          render: () => '',
          createdCell: (cell, _cellData, rowData: { case_id?: string }) => {
            cell.innerHTML = '';
            const caseId = rowData?.case_id ?? '';
            const root = createRoot(cell);
            root.render(<TaskRowAction caseId={caseId} />);
            roots.add(root);
          },
        },
      },
    });

    const dt = (KTDataTable as unknown as { getInstance: (el: HTMLElement) => InstanceType<typeof KTDataTable> | null }).getInstance?.(el);
    if (!dt) return;

    const drawEventId = (dt as { on(eventType: string, callback: () => void): string }).on('draw', unmountActionRoots);

    datatableRef.current = dt;
    return () => {
      unmountActionRoots();
      try {
        (dt as { off(eventType: string, eventId: string): void }).off('draw', drawEventId);
      } catch (_) {}
      try {
        dt.dispose();
      } catch (_) {}
      datatableRef.current = null;
    };
  }, [token, statusFilter, dateFrom, dateTo, effectiveDateTo, effectiveStatusParam, user?.role_name]);

  const handleCreateSuccess = () => {
    setCreateOpen(false);
    if (datatableRef.current) datatableRef.current.reload();
  };

  const tableId = 'kt_datatable_tasks';
  const isStaff = user?.role_name === 'staff';

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title="Tugas"
          description={isStaff ? 'Task yang ditugaskan ke Anda — lihat untuk akta mana dan siapa penanggung jawab' : 'Semua task kantor — lihat untuk akta mana dan siapa penanggung jawab'}
        />
        <ToolbarActions>
          <Button variant="outline" size="sm" asChild>
            <Link href="/workflow-templates" className="gap-2">
              <Workflow className="size-4" />
              Template Workflow
            </Link>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Tambah Tahapan
          </Button>
        </ToolbarActions>
      </Toolbar>

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        token={token}
        onSuccess={handleCreateSuccess}
      />

      <div className="container">
        {error && <p className="mb-4 text-destructive">{error}</p>}

        <div className="grid w-full space-y-5">
          <div className="kt-card">
            <div className="kt-card-header flex flex-row items-center justify-between gap-4 py-4 min-h-14 border-b border-border">
              <div className="relative w-full max-w-sm shrink-0">
                <Search className="pointer-events-none size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari akta, tahapan, atau penanggung jawab..."
                  className="kt-input h-9 w-full pl-9 pr-3"
                  data-kt-datatable-search={`#${tableId}`}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={statusFilter || 'all'}
                  onValueChange={(v) => {
                    setStatusFilter(v === 'all' ? '' : v);
                    if (v === 'overdue') {
                      setDateRange({ from: undefined, to: subDays(new Date(), 1) });
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px] h-9">
                    <SelectValue placeholder="Semua status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua status</SelectItem>
                    <SelectItem value="overdue">Overdue (melewati batas)</SelectItem>
                    {TASK_STATUSES.map((s) => (
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
                        <span className="text-muted-foreground">Jatuh tempo</span>
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
                {(dateFrom || dateTo || statusFilter === 'overdue') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 text-muted-foreground"
                    onClick={() => {
                      setDateRange(undefined);
                      if (statusFilter === 'overdue') setStatusFilter('');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
            <div
              key={`table-tasks-${statusFilter}-${dateFrom}-${effectiveDateTo}`}
              ref={containerRef}
              id={tableId}
              className="kt-card-table"
            >
              <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
                <table className="kt-table" data-kt-datatable-table="true">
                  <thead>
                    <tr>
                      <th scope="col" className="w-[220px]" data-kt-datatable-column="case_nama_para_pihak">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Akta / Berkas</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-40" data-kt-datatable-column="nama_task">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Tahapan</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-36" data-kt-datatable-column="assigned_to_name">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Penanggung jawab</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-28" data-kt-datatable-column="status">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Status</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-28" data-kt-datatable-column="due_date">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Jatuh tempo</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-24" data-kt-datatable-column="actions" />
                    </tr>
                  </thead>
                  <tbody />
                </table>
              </div>
              <div className="kt-datatable-toolbar">
                <div className="kt-datatable-length">
                  Tampilkan
                  <select className="kt-select kt-select-sm w-16" name="perpage" data-kt-datatable-size="true" />
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
    </>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  onSuccess: () => void;
}) {
  const [cases, setCases] = useState<{ id: string; label: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [caseId, setCaseId] = useState('');
  const [namaTask, setNamaTask] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && token) {
      getCasesApi(token, { limit: 200 }).then((res) => {
        setCases(res.data.map((c) => {
          const nama = c.nama_para_pihak?.trim();
          const nomor = c.nomor_draft?.trim();
          const jenis = c.jenis_akta?.trim();
          const label = nama ? (nomor ? `${nama} — ${nomor}` : nama) : (nomor || jenis || c.id);
          return { id: c.id, label };
        }));
      }).catch(() => setCases([]));
      getUsersApi(token).then((u) => {
        setUsers(u.map((x) => ({ id: x.id, name: x.name?.trim() ? x.name : x.email })));
      }).catch(() => setUsers([]));
      setCaseId('');
      setNamaTask('');
      setDueDate('');
      setAssignedTo('');
      setErr(null);
    }
  }, [open, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId.trim()) {
      setErr('Pilih akta/berkas.');
      return;
    }
    if (!namaTask.trim()) {
      setErr('Nama tahapan wajib.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await createTaskApi(token, {
        case_id: caseId,
        nama_task: namaTask.trim(),
        due_date: dueDate.trim() || undefined,
        assigned_to: assignedTo.trim() || undefined,
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal membuat task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Tahapan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="space-y-2">
              <Label>Akta / Berkas *</Label>
              <Select value={caseId || '_none'} onValueChange={(v) => setCaseId(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akta yang akan ditambah tahapannya" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Pilih akta —</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama_task">Nama tahapan *</Label>
              <Input
                id="nama_task"
                value={namaTask}
                onChange={(e) => setNamaTask(e.target.value)}
                placeholder="Contoh: Terima dokumen, Draft akta"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Penanggung jawab</Label>
              <Select value={assignedTo || '_none'} onValueChange={(v) => setAssignedTo(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih siapa yang mengerjakan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Belum ditentukan —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Jatuh tempo</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
