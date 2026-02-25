'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import {
  getJenisPekerjaanApi,
  createJenisPekerjaanApi,
  updateJenisPekerjaanApi,
  type JenisPekerjaanResponse,
  type JenisPekerjaanCategory,
  type CreateJenisPekerjaanBody,
  type UpdateJenisPekerjaanBody,
} from '@/lib/api';
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
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { cn } from '@/lib/utils';

const CATEGORY_OPTIONS: { value: JenisPekerjaanCategory; label: string }[] = [
  { value: 'notaris', label: 'Notaris' },
  { value: 'ppat', label: 'PPAT' },
  { value: 'pengurusan', label: 'Pengurusan' },
];

function formatBiaya(v: number | null | undefined): string {
  if (v == null) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
}

/** Format number for table display (nominal). */
function formatNominal(v: number | null | undefined): string {
  if (v == null) return '-';
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

const TABLE_ID = 'kt_datatable_jenis_pekerjaan';

export default function JenisPekerjaanPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [items, setItems] = useState<JenisPekerjaanResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('__all__');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(''); // '' = all, 'active' | 'inactive'
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<JenisPekerjaanResponse | null>(null);

  const isAdmin = user?.role_name === 'admin';

  const filteredItems = useMemo(() => {
    let list = items;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => (item.name ?? '').toLowerCase().includes(q));
    }
    if (statusFilter === 'active') {
      list = list.filter((item) => item.active !== false);
    } else if (statusFilter === 'inactive') {
      list = list.filter((item) => item.active === false);
    }
    return list;
  }, [items, searchQuery, statusFilter]);

  const columns = useMemo<ColumnDef<JenisPekerjaanResponse>[]>(
    () => [
      { accessorKey: 'name', header: 'Nama', cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
      {
        accessorKey: 'singkatan',
        header: 'Singkatan',
        cell: ({ getValue }) => {
          const v = getValue<string | null | undefined>();
          return v ? <span className="kt-badge kt-badge-light-primary">{v}</span> : '-';
        },
      },
      {
        accessorKey: 'category',
        header: 'Kategori',
        cell: ({ getValue }) => CATEGORY_OPTIONS.find((c) => c.value === getValue<JenisPekerjaanCategory>())?.label ?? getValue(),
      },
      { accessorKey: 'biaya', header: 'Biaya', cell: ({ getValue }) => <span className="tabular-nums">{formatNominal(getValue<number | null | undefined>())}</span> },
      {
        accessorKey: 'active',
        header: 'Status',
        cell: ({ getValue }) => {
          const active = getValue<boolean>();
          const label = active === false ? 'Nonaktif' : 'Aktif';
          const cls = active === false ? 'kt-badge kt-badge-secondary' : 'kt-badge kt-badge-success';
          return <span className={cls}>{label}</span>;
        },
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            aria-label="Edit"
            onClick={() => setEditItem(row.original)}
          >
            <Pencil className="size-4" />
          </Button>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getJenisPekerjaanApi(token, {
        category: categoryFilter && categoryFilter !== '__all__' ? (categoryFilter as JenisPekerjaanCategory) : undefined,
      });
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [token, categoryFilter]);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [isAdmin, router, load]);

  if (!isAdmin) return null;

  const pagination = table.getState().pagination;
  const pageSize = pagination.pageSize;
  const pageIndex = pagination.pageIndex;
  const totalRows = filteredItems.length;
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, totalRows);
  const pageCount = table.getPageCount();

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Manajemen Pekerjaan" />
        <ToolbarActions>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="me-2 size-4" />
            Tambah Jenis Pekerjaan
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
                  placeholder="Cari nama..."
                  className="kt-input h-9 w-full pl-9 pr-3"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Semua kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Semua kategori</SelectItem>
                    {CATEGORY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter || 'all'}
                  onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Semua status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua status</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
                {(searchQuery.trim() || statusFilter || (categoryFilter && categoryFilter !== '__all__')) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0 text-muted-foreground"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('');
                      setCategoryFilter('__all__');
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
            <div id={TABLE_ID} className="kt-card-table">
              <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
                <table className="kt-table w-full align-middle">
                  <thead>
                    <tr>
                      <th scope="col" className="w-[200px]">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Nama</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-24">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Singkatan</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-32">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Kategori</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-32">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Biaya</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-28">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Status</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted-foreground py-8">
                          Memuat...
                        </td>
                      </tr>
                    ) : table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted-foreground py-8">
                          Belum ada jenis pekerjaan. Klik &quot;Tambah Jenis Pekerjaan&quot;.
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="align-middle">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="kt-datatable-toolbar">
                <div className="kt-datatable-length flex flex-wrap items-center gap-2">
                  Tampilkan
                  <select
                    className="kt-select kt-select-sm w-16"
                    value={pageSize}
                    onChange={(e) =>
                      table.setPageSize(Number(e.target.value))
                    }
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  per halaman
                </div>
                <div className="kt-datatable-info flex flex-wrap items-center gap-2">
                  <span>
                    {totalRows === 0
                      ? '0 data'
                      : `${start}-${end} dari ${totalRows}`}
                  </span>
                  {pageCount > 1 && (() => {
                    const limit = 5;
                    const groupStart = Math.floor(pageIndex / limit) * limit;
                    const groupEnd = Math.min(groupStart + limit, pageCount);
                    return (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => table.previousPage()}
                          disabled={!table.getCanPreviousPage()}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        {groupStart > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 min-w-7 p-0 text-sm"
                            onClick={() => table.setPageIndex(groupStart - 1)}
                          >
                            ...
                          </Button>
                        )}
                        {Array.from({ length: groupEnd - groupStart }, (_, i) => groupStart + i).map((i) => (
                          <Button
                            key={i}
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'size-7 min-w-7 p-0 text-sm',
                              pageIndex === i && 'bg-accent text-accent-foreground'
                            )}
                            onClick={() => table.setPageIndex(i)}
                          >
                            {i + 1}
                          </Button>
                        ))}
                        {groupEnd < pageCount && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 min-w-7 p-0 text-sm"
                            onClick={() => table.setPageIndex(groupEnd)}
                          >
                            ...
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => table.nextPage()}
                          disabled={!table.getCanNextPage()}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateJenisPekerjaanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        token={token}
        onSuccess={() => {
          setCreateOpen(false);
          load();
        }}
      />

      {editItem && (
        <EditJenisPekerjaanDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          item={editItem}
          token={token}
          onSuccess={() => {
            setEditItem(null);
            load();
          }}
        />
      )}
    </>
  );
}

function CreateJenisPekerjaanDialog({
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
  const [name, setName] = useState('');
  const [singkatan, setSingkatan] = useState('');
  const [category, setCategory] = useState<JenisPekerjaanCategory>('notaris');
  const [biaya, setBiaya] = useState<number | null>(null);
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName('');
    setSingkatan('');
    setCategory('notaris');
    setBiaya(null);
    setActive(true);
    setErr(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) {
      setErr('Nama wajib diisi.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const body: CreateJenisPekerjaanBody = {
        name: name.trim(),
        category,
        active,
      };
      if (singkatan.trim()) body.singkatan = singkatan.trim();
      if (biaya != null) body.biaya = biaya;
      await createJenisPekerjaanApi(token, body);
      reset();
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Jenis Pekerjaan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="space-y-2">
              <Label htmlFor="jp-name">Nama *</Label>
              <Input
                id="jp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Akta Jual Beli"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-singkatan">Singkatan</Label>
              <Input
                id="jp-singkatan"
                value={singkatan}
                onChange={(e) => setSingkatan(e.target.value)}
                placeholder="Contoh: AJB (untuk badge di card)"
                maxLength={32}
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as JenisPekerjaanCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-biaya">Biaya (Rp)</Label>
              <CurrencyInput
                id="jp-biaya"
                value={biaya}
                onChange={setBiaya}
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="jp-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="jp-active">Aktif</Label>
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

function EditJenisPekerjaanDialog({
  open,
  onOpenChange,
  item,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: JenisPekerjaanResponse;
  token: string | null;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [singkatan, setSingkatan] = useState(item.singkatan ?? '');
  const [category, setCategory] = useState<JenisPekerjaanCategory>(item.category);
  const [biaya, setBiaya] = useState<number | null>(item.biaya ?? null);
  const [active, setActive] = useState(item.active);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setName(item.name);
    setSingkatan(item.singkatan ?? '');
    setCategory(item.category);
    setBiaya(item.biaya ?? null);
    setActive(item.active);
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) {
      setErr('Nama wajib diisi.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const body: UpdateJenisPekerjaanBody = { name: name.trim(), category, active, biaya };
      body.singkatan = singkatan.trim() || null;
      await updateJenisPekerjaanApi(token, item.id, body);
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Jenis Pekerjaan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="space-y-2">
              <Label htmlFor="jp-edit-name">Nama *</Label>
              <Input
                id="jp-edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-edit-singkatan">Singkatan</Label>
              <Input
                id="jp-edit-singkatan"
                value={singkatan}
                onChange={(e) => setSingkatan(e.target.value)}
                placeholder="Contoh: AJB (untuk badge di card)"
                maxLength={32}
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as JenisPekerjaanCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jp-edit-biaya">Biaya (Rp)</Label>
              <CurrencyInput
                id="jp-edit-biaya"
                value={biaya}
                onChange={setBiaya}
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="jp-edit-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="jp-edit-active">Aktif</Label>
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
