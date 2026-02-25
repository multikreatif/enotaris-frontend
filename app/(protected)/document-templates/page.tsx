'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ColumnDef,
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
  getDocumentRequirementTemplatesApi,
  createDocumentRequirementTemplateApi,
  type DocumentRequirementTemplateResponse,
  type CreateDocumentRequirementItemBody,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { DataGrid, DataGridContainer } from '@/components/ui/data-grid';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
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
import { Plus, Trash2 } from 'lucide-react';

type ItemRow = { item_key: string; document_name: string; document_category: string };

export default function DocumentTemplatesPage() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<DocumentRequirementTemplateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getDocumentRequirementTemplatesApi(token);
      setTemplates(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat template');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const columns = useMemo<ColumnDef<DocumentRequirementTemplateResponse>[]>(
    () => [
      { accessorKey: 'name', header: 'Nama', cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
      { accessorKey: 'category', header: 'Kategori', cell: ({ getValue }) => getValue<string>() === 'ppat' ? 'PPAT' : 'Notaris' },
      { accessorKey: 'jenis_pekerjaan', header: 'Jenis Pekerjaan', cell: ({ getValue }) => getValue<string>() ?? '-' },
      {
        id: 'items_count',
        header: 'Jumlah Dokumen Syarat',
        cell: ({ row }) => row.original.items?.length ?? 0,
      },
    ],
    []
  );

  const table = useReactTable({
    data: templates,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Template Dokumen Persyaratan" description="Daftar dokumen syarat per jenis pekerjaan (untuk tab Dokumen di berkas akta)." />
        <ToolbarActions>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1" />
            Buat Template
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="p-4">
        {error && (
          <p className="text-destructive text-sm mb-4">{error}</p>
        )}
        <DataGrid
          table={table}
          recordCount={templates.length}
          isLoading={loading}
          emptyMessage="Belum ada template dokumen. Buat template untuk mendefinisikan dokumen persyaratan per jenis pekerjaan."
        >
          <DataGridContainer>
            <DataGridTable />
          </DataGridContainer>
          <DataGridPagination />
        </DataGrid>
      </div>

      <CreateDocumentTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        token={token}
        onSuccess={() => {
          setCreateOpen(false);
          loadTemplates();
        }}
      />
    </>
  );
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const CATEGORY_OPTIONS = [
  { value: 'notaris', label: 'Notaris' },
  { value: 'ppat', label: 'PPAT' },
];

const DOC_CATEGORY_OPTIONS = [
  { value: 'UTAMA', label: 'UTAMA' },
  { value: 'IDENTITAS', label: 'IDENTITAS' },
  { value: 'PAJAK', label: 'PAJAK' },
  { value: 'LAINNYA', label: 'LAINNYA' },
];

function CreateDocumentTemplateDialog({
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
  const [category, setCategory] = useState<string>('notaris');
  const [jenisPekerjaan, setJenisPekerjaan] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ item_key: '', document_name: '', document_category: 'UTAMA' }]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName('');
    setCategory('notaris');
    setJenisPekerjaan('');
    setDescription('');
    setItems([{ item_key: '', document_name: '', document_category: 'UTAMA' }]);
    setErr(null);
  }, []);

  const addItem = () => setItems((s) => [...s, { item_key: '', document_name: '', document_category: 'UTAMA' }]);
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((s) => s.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof ItemRow, value: string) => {
    setItems((s) => s.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
    if (field === 'document_name') {
      setItems((s) => s.map((row, i) => (i === idx ? { ...row, item_key: slugify(value) || row.item_key } : row)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) {
      setErr('Nama template wajib.');
      return;
    }
    const itemList = items.filter((r) => r.document_name.trim() && r.item_key.trim());
    if (itemList.length === 0) {
      setErr('Minimal satu dokumen persyaratan dengan nama dan key.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const itemBodies: CreateDocumentRequirementItemBody[] = itemList.map((r, i) => ({
        item_key: r.item_key.trim(),
        document_name: r.document_name.trim(),
        document_category: r.document_category || 'UTAMA',
        sort_order: i,
      }));
      await createDocumentRequirementTemplateApi(token, {
        name: name.trim(),
        category: category || 'notaris',
        jenis_pekerjaan: jenisPekerjaan.trim() || undefined,
        description: description.trim() || undefined,
        items: itemBodies,
      });
      reset();
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Template Dokumen Persyaratan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="space-y-2">
              <Label htmlFor="dt-name">Nama template</Label>
              <Input
                id="dt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Persyaratan AJB"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dt-jenis">Jenis pekerjaan (opsional)</Label>
              <Input
                id="dt-jenis"
                value={jenisPekerjaan}
                onChange={(e) => setJenisPekerjaan(e.target.value)}
                placeholder="Contoh: AJB, Hibah, Pendirian PT"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dt-desc">Deskripsi (opsional)</Label>
              <Input
                id="dt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Dokumen persyaratan</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="size-4 mr-1" />
                  Tambah
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Daftar dokumen yang wajib dilampirkan untuk berkas dengan jenis pekerjaan ini. Tab Dokumen di detail berkas akan menampilkan daftar ini.
              </p>
              <div className="space-y-2 rounded border p-2 bg-muted/30">
                {items.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[160px] space-y-1">
                      <span className="text-xs text-muted-foreground">Nama dokumen</span>
                      <Input
                        value={row.document_name}
                        onChange={(e) => updateItem(idx, 'document_name', e.target.value)}
                        placeholder="Contoh: Sertifikat Tanah Asli"
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <span className="text-xs text-muted-foreground">Key (slug)</span>
                      <Input
                        value={row.item_key}
                        onChange={(e) => updateItem(idx, 'item_key', e.target.value)}
                        placeholder="sertifikat_tanah"
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <span className="text-xs text-muted-foreground">Kategori</span>
                      <Select
                        value={row.document_category}
                        onValueChange={(v) => updateItem(idx, 'document_category', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOC_CATEGORY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      title="Hapus"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
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
