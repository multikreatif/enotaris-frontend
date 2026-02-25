'use client';

import { useEffect, useState } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Filter, Plus } from 'lucide-react';
import {
  getProtocolEntriesApi,
  createProtocolEntryApi,
  getCasesApi,
  type ProtocolEntry,
  type CaseResponse,
} from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function ProtocolPage() {
  const { token } = useAuth();
  const [year, setYear] = useState<string>('');
  const [jenis, setJenis] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [entries, setEntries] = useState<ProtocolEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cases, setCases] = useState<CaseResponse[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [formCaseId, setFormCaseId] = useState<string>('');
  const [formYear, setFormYear] = useState<string>('');
  const [formRepertorium, setFormRepertorium] = useState('');
  const [formJenis, setFormJenis] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'closed'>('active');
  const [formNotes, setFormNotes] = useState('');

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const yearNum = year.trim() ? Number(year.trim()) || undefined : undefined;
      const statusParam =
        status.trim() && status.trim() !== 'all' ? status.trim() : undefined;
      const { data, total } = await getProtocolEntriesApi(token, {
        year: yearNum,
        jenis: jenis.trim() || undefined,
        status: statusParam,
        limit: 100,
        offset: 0,
      });
      setEntries(data);
      setTotal(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat digital protocol');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Load list berkas untuk dipilih saat dialog tambah dibuka (sekali per buka).
  useEffect(() => {
    if (!createOpen || !token) return;
    setLoadingCases(true);
    getCasesApi(token, { limit: 200 })
      .then((res) => setCases(res.data))
      .catch(() => setCases([]))
      .finally(() => setLoadingCases(false));
  }, [createOpen, token]);

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title={
            <span className="inline-flex items-center gap-2">
              <FileText className="size-5" />
              <span>Digital Protocol</span>
            </span>
          }
          description="Daftar repertorium dan lokasi fisik minuta."
        />
        <ToolbarActions>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Tahun"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-24"
                inputMode="numeric"
              />
              <Input
                placeholder="Jenis (AJB, APHT, ...)"
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                className="w-40"
              />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              <Filter className="me-2 size-4" />
              Terapkan Filter
            </Button>
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="me-1.5 size-4" />
              Tambah Entri
            </Button>
          </div>
        </ToolbarActions>
      </Toolbar>

      <div className="container pb-10">
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <div className="kt-card p-4 overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat data protocol...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada entri Digital Protocol. Nanti di sini akan muncul daftar No Repertorium, jenis, lokasi rak, dan status.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                {total} entri
              </p>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-2 text-left">Tahun</th>
                    <th className="py-2 text-left">No Repertorium</th>
                    <th className="py-2 text-left">Jenis</th>
                    <th className="py-2 text-left">Lokasi Fisik</th>
                    <th className="py-2 text-left">Status</th>
                    <th className="py-2 text-left">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="py-2 align-top">{e.year}</td>
                      <td className="py-2 align-top font-medium">{e.repertorium_number}</td>
                      <td className="py-2 align-top">{e.jenis}</td>
                      <td className="py-2 align-top">{e.physical_location}</td>
                      <td className="py-2 align-top">
                        <span
                          className={
                            e.status === 'active'
                              ? 'kt-badge kt-badge-success'
                              : 'kt-badge kt-badge-secondary'
                          }
                        >
                          {e.status === 'active' ? 'Active' : 'Closed'}
                        </span>
                      </td>
                      <td className="py-2 align-top text-xs text-muted-foreground">
                        {e.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Entri Digital Protocol</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Berkas terkait (opsional)</Label>
                <Select
                  value={formCaseId || '_none'}
                  onValueChange={(v) => setFormCaseId(v === '_none' ? '' : v)}
                  disabled={loadingCases}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCases ? 'Memuat berkas...' : 'Pilih berkas'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Tidak dikaitkan</SelectItem>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nomor_draft || c.jenis_akta || c.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">Tahun</Label>
                <Input
                  id="year"
                  placeholder={String(new Date().getFullYear())}
                  value={formYear}
                  onChange={(e) => setFormYear(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="repertorium">No Repertorium</Label>
                <Input
                  id="repertorium"
                  placeholder="mis. 12/2026"
                  value={formRepertorium}
                  onChange={(e) => setFormRepertorium(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jenis">Jenis</Label>
              <Input
                id="jenis"
                value={formJenis}
                onChange={(e) => setFormJenis(e.target.value)}
                placeholder="mis. AJB, APHT, dsb."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lokasi">Lokasi fisik</Label>
              <Input
                id="lokasi"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="mis. Rak A1, Box B2"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={formStatus}
                onValueChange={(v) => setFormStatus(v as 'active' | 'closed')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Catatan (opsional)</Label>
              <Input
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Catatan tambahan"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!token) return;
                const yearValue =
                  formYear.trim() !== ''
                    ? Number(formYear.trim())
                    : new Date().getFullYear();
                if (!yearValue || isNaN(yearValue)) {
                  setError('Tahun tidak valid.');
                  return;
                }
                if (!formRepertorium.trim() || !formJenis.trim() || !formLocation.trim()) {
                  setError('No repertorium, jenis, dan lokasi wajib diisi.');
                  return;
                }
                try {
                  setError(null);
                  const created = await createProtocolEntryApi(token, {
                    case_id: formCaseId || undefined,
                    year: yearValue,
                    repertorium_number: formRepertorium.trim(),
                    jenis: formJenis.trim(),
                    physical_location: formLocation.trim(),
                    status: formStatus,
                    notes: formNotes.trim() || undefined,
                  });
                  setCreateOpen(false);
                  setFormCaseId('');
                  setFormYear('');
                  setFormRepertorium('');
                  setFormJenis('');
                  setFormLocation('');
                  setFormStatus('active');
                  setFormNotes('');
                  // Prepend entry baru agar langsung terlihat.
                  setEntries((prev) => [created, ...prev]);
                  setTotal((prev) => prev + 1);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : 'Gagal membuat entri Digital Protocol'
                  );
                }
              }}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

