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
  getWorkflowTemplatesApi,
  createWorkflowTemplateApi,
  type WorkflowTemplateItem,
  type CreateWorkflowTemplateStepBody,
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

type StepRow = { nama_task: string; due_date_rule: string };

export default function WorkflowTemplatesPage() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getWorkflowTemplatesApi(token);
      setTemplates(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat template');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const columns = useMemo<ColumnDef<WorkflowTemplateItem>[]>(
    () => [
      { accessorKey: 'name', header: 'Nama', cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
      { accessorKey: 'category', header: 'Kategori' },
      { accessorKey: 'jenis_pekerjaan', header: 'Jenis Pekerjaan', cell: ({ getValue }) => getValue<string>() ?? '-' },
      {
        id: 'steps_count',
        header: 'Jumlah Step',
        cell: ({ row }) => row.original.steps?.length ?? 0,
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
        <ToolbarHeading title="Template Workflow" />
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
          emptyMessage="Belum ada template workflow. Buat template untuk mengatur urutan task per jenis pekerjaan."
        >
          <DataGridContainer>
            <DataGridTable />
          </DataGridContainer>
          <DataGridPagination />
        </DataGrid>
      </div>

      <CreateWorkflowTemplateDialog
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

function CreateWorkflowTemplateDialog({
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
  const [steps, setSteps] = useState<StepRow[]>([{ nama_task: '', due_date_rule: 'case_start+7' }]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName('');
    setCategory('notaris');
    setJenisPekerjaan('');
    setDescription('');
    setSteps([{ nama_task: '', due_date_rule: 'case_start+7' }]);
    setErr(null);
  }, []);

  const addStep = () => setSteps((s) => [...s, { nama_task: '', due_date_rule: 'case_start+7' }]);
  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps((s) => s.filter((_, i) => i !== idx));
  };
  const updateStep = (idx: number, field: keyof StepRow, value: string) => {
    setSteps((s) => s.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !name.trim()) {
      setErr('Nama template wajib.');
      return;
    }
    const stepList = steps.map((r) => r.nama_task.trim()).filter(Boolean);
    if (stepList.length === 0) {
      setErr('Minimal satu step dengan nama task.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const stepBodies: CreateWorkflowTemplateStepBody[] = steps
        .filter((r) => r.nama_task.trim())
        .map((r, i) => ({
          nama_task: r.nama_task.trim(),
          sort_order: i,
          due_date_rule: r.due_date_rule.trim() || undefined,
        }));
      await createWorkflowTemplateApi(token, {
        name: name.trim(),
        category: category || 'notaris',
        jenis_pekerjaan: jenisPekerjaan.trim() || undefined,
        description: description.trim() || undefined,
        steps: stepBodies,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Template Workflow</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="space-y-2">
              <Label htmlFor="wt-name">Nama template</Label>
              <Input
                id="wt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Workflow AJB"
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
                  <SelectItem value="notaris">Notaris</SelectItem>
                  <SelectItem value="ppat">PPAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wt-jenis">Jenis pekerjaan (opsional)</Label>
              <Input
                id="wt-jenis"
                value={jenisPekerjaan}
                onChange={(e) => setJenisPekerjaan(e.target.value)}
                placeholder="Contoh: ajb, hibah"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wt-desc">Deskripsi (opsional)</Label>
              <Input
                id="wt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Step / urutan task</Label>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  <Plus className="size-4 mr-1" />
                  Tambah step
                </Button>
              </div>
              <div className="space-y-2 rounded border p-2 bg-muted/30">
                {steps.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-end flex-wrap">
                    <div className="flex-1 min-w-[140px] space-y-1">
                      <span className="text-xs text-muted-foreground">Nama task</span>
                      <Input
                        value={row.nama_task}
                        onChange={(e) => updateStep(idx, 'nama_task', e.target.value)}
                        placeholder="Nama task"
                      />
                    </div>
                    <div className="w-[160px] space-y-1">
                      <span className="text-xs text-muted-foreground">Due date rule</span>
                      <Input
                        value={row.due_date_rule}
                        onChange={(e) => updateStep(idx, 'due_date_rule', e.target.value)}
                        placeholder="case_start+7"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStep(idx)}
                      disabled={steps.length <= 1}
                      title="Hapus step"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Due date rule: case_start+7 = 7 hari dari mulai perkara; previous_done+3 = 3 hari setelah task sebelumnya selesai.
              </p>
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
