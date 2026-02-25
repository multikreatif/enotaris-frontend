'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useRouter } from 'next/navigation';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import {
  createClientApi,
  getClientApi,
  updateClientApi,
  type ClientResponse,
  type ClientType,
  type CreateClientBody,
  type UpdateClientBody,
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Pencil, FileText, Search, CalendarDays } from 'lucide-react';
import { KTDataTable } from '@keenthemes/ktui';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

/** Tombol aksi baris: Edit klien + Lihat case (client-side navigation) */
function ClientRowActions({
  clientId,
  onEdit,
  router,
}: {
  clientId: string;
  onEdit: (id: string) => void;
  router: { push: (href: string) => void };
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        title="Edit"
        aria-label="Edit klien"
        onClick={() => onEdit(clientId)}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Lihat case"
        aria-label="Lihat case terkait"
        onClick={() => router.push(`/cases?client_id=${encodeURIComponent(clientId)}`)}
      >
        <FileText className="size-4" />
      </Button>
    </span>
  );
}

function escapeHtml(s: string): string {
  if (typeof document === 'undefined') return s;
  const el = document.createElement('div');
  el.textContent = s;
  return el.innerHTML;
}

const CLIENT_TYPES = ['individual', 'entity'] as const;
const CLIENT_TYPE_LABELS: Record<string, string> = {
  individual: 'Perorangan',
  entity: 'Badan Hukum',
};

export default function ClientsPage() {
  const { token } = useAuth();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const datatableRef = useRef<InstanceType<typeof KTDataTable> | null>(null);
  const actionRootsRef = useRef<Set<Root>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateFrom = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '';
  const dateTo = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '';

  const filterRef = useRef({ typeFilter, dateFrom, dateTo });
  filterRef.current = { typeFilter, dateFrom, dateTo };

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
    if (typeFilter) params.set('type', typeFilter);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const apiEndpoint = `/api/clients?${params.toString()}`;

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
      infoEmpty: 'Belum ada klien. Klik "Tambah Klien" untuk menambah.',
      info: '{start}-{end} dari {total}',
      mapRequest: (query: URLSearchParams) => {
        const f = filterRef.current;
        if (f.typeFilter) query.set('type', f.typeFilter);
        if (f.dateFrom) query.set('date_from', f.dateFrom);
        if (f.dateTo) query.set('date_to', f.dateTo);
        return query;
      },
      mapResponse: (res: { data?: unknown[]; totalCount?: number }) => ({
        data: res.data ?? [],
        totalCount: res.totalCount ?? 0,
      }),
      columns: {
        full_name: {
          render: (value) => `<span class="font-medium">${escapeHtml(String(value ?? '')) || '-'}</span>`,
        },
        type_label: {
          render: (value) => escapeHtml(String(value ?? '')) || '-',
        },
        nik_npwp: {
          render: (value) => `<span class="text-muted-foreground">${escapeHtml(String(value ?? ''))}</span>`,
        },
        kontak: {
          render: (value) => `<span class="text-muted-foreground max-w-[200px] truncate block">${escapeHtml(String(value ?? ''))}</span>`,
        },
        last_activity: {
          render: (value) => {
            if (!value) return '-';
            try {
              const d = new Date(String(value));
              return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch {
              return '-';
            }
          },
        },
        actions: {
          render: () => '',
          createdCell: (cell, _cellData, rowData: { id?: string }) => {
            cell.innerHTML = '';
            const clientId = rowData?.id ?? '';
            const root = createRoot(cell);
            root.render(
              <ClientRowActions
                clientId={clientId}
                onEdit={(id) => setEditId(id)}
                router={router}
              />
            );
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
  }, [token, typeFilter, dateFrom, dateTo, router]);

  const handleCreateSuccess = () => {
    setCreateOpen(false);
    if (datatableRef.current) datatableRef.current.reload();
  };

  const handleEditSuccess = () => {
    setEditId(null);
    if (datatableRef.current) datatableRef.current.reload();
  };

  const tableId = 'kt_datatable_clients';

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Manajemen Klien" />
        <ToolbarActions>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="me-2 size-4" />
            Tambah Klien
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
                <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Semua tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua tipe</SelectItem>
                    {CLIENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CLIENT_TYPE_LABELS[t] ?? t}
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
              key={`table-clients-${typeFilter}-${dateFrom}-${dateTo}`}
              ref={containerRef}
              id={tableId}
              className="kt-card-table"
            >
              <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
                <table className="kt-table" data-kt-datatable-table="true">
                  <thead>
                    <tr>
                      <th scope="col" className="w-[200px]" data-kt-datatable-column="full_name">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Nama / Badan Hukum</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-32" data-kt-datatable-column="type_label">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Tipe</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-40" data-kt-datatable-column="nik_npwp">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">NIK / NPWP</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-44" data-kt-datatable-column="kontak">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Kontak</span>
                          <span className="kt-table-col-sort" />
                        </span>
                      </th>
                      <th scope="col" className="w-28" data-kt-datatable-column="last_activity">
                        <span className="kt-table-col">
                          <span className="kt-table-col-label">Aktivitas terakhir</span>
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

      <CreateClientDialog open={createOpen} onOpenChange={setCreateOpen} token={token} onSuccess={handleCreateSuccess} />

      {editId && (
        <EditClientDialog
          open={!!editId}
          onOpenChange={(open) => !open && setEditId(null)}
          clientId={editId}
          token={token}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}

function CreateClientDialog({
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
  const [type, setType] = useState<ClientType>('individual');
  const [fullName, setFullName] = useState('');
  const [nik, setNik] = useState('');
  const [npwp, setNpwp] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [religion, setReligion] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [occupation, setOccupation] = useState('');
  const [nationality, setNationality] = useState('WNI');
  const [establishmentDeedNumber, setEstablishmentDeedNumber] = useState('');
  const [establishmentDate, setEstablishmentDate] = useState('');
  const [nib, setNib] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    setType('individual');
    setFullName('');
    setNik('');
    setNpwp('');
    setPlaceOfBirth('');
    setDateOfBirth('');
    setGender('');
    setReligion('');
    setMaritalStatus('');
    setOccupation('');
    setNationality('WNI');
    setEstablishmentDeedNumber('');
    setEstablishmentDate('');
    setNib('');
    setContactPersonName('');
    setAddressLine('');
    setKelurahan('');
    setKecamatan('');
    setCity('');
    setProvince('');
    setPostalCode('');
    setPhone('');
    setEmail('');
    setErr(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErr('Nama lengkap / nama badan hukum wajib.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const body: CreateClientBody = {
        type,
        full_name: fullName.trim(),
        nik: nik.trim() || undefined,
        npwp: npwp.trim() || undefined,
        place_of_birth: placeOfBirth.trim() || undefined,
        date_of_birth: dateOfBirth.trim() || undefined,
        gender: gender || undefined,
        religion: religion.trim() || undefined,
        marital_status: maritalStatus.trim() || undefined,
        occupation: occupation.trim() || undefined,
        nationality: nationality.trim() || undefined,
        establishment_deed_number: establishmentDeedNumber.trim() || undefined,
        establishment_date: establishmentDate.trim() || undefined,
        nib: nib.trim() || undefined,
        contact_person_name: contactPersonName.trim() || undefined,
        address_line: addressLine.trim() || undefined,
        kelurahan: kelurahan.trim() || undefined,
        kecamatan: kecamatan.trim() || undefined,
        city: city.trim() || undefined,
        province: province.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      };
      await createClientApi(token, body);
      reset();
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan klien');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Klien</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="space-y-2">
              <Label>Tipe</Label>
              <Select value={type} onValueChange={(v) => setType(v as ClientType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Perorangan</SelectItem>
                  <SelectItem value="entity">Badan Hukum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">{type === 'individual' ? 'Nama lengkap' : 'Nama badan hukum'} *</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={type === 'individual' ? 'Nama sesuai KTP' : 'Nama PT/CV/Yayasan'}
                required
              />
            </div>
            {type === 'individual' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nik">NIK</Label>
                    <Input id="nik" value={nik} onChange={(e) => setNik(e.target.value)} placeholder="16 digit" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="npwp">NPWP</Label>
                    <Input id="npwp" value={npwp} onChange={(e) => setNpwp(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="place_of_birth">Tempat lahir</Label>
                    <Input id="place_of_birth" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Tanggal lahir</Label>
                    <Input id="date_of_birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jenis kelamin</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="religion">Agama</Label>
                    <Input id="religion" value={religion} onChange={(e) => setReligion(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marital">Status perkawinan</Label>
                    <Input id="marital" value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} placeholder="Kawin / Belum kawin / Cerai" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">Pekerjaan</Label>
                    <Input id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Kewarganegaraan</Label>
                  <Input id="nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
                </div>
              </>
            )}
            {type === 'entity' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="npwp_ent">NPWP</Label>
                  <Input id="npwp_ent" value={npwp} onChange={(e) => setNpwp(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="akta">No. akta pendirian</Label>
                    <Input id="akta" value={establishmentDeedNumber} onChange={(e) => setEstablishmentDeedNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tgl_akta">Tanggal akta</Label>
                    <Input id="tgl_akta" type="date" value={establishmentDate} onChange={(e) => setEstablishmentDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nib">NIB</Label>
                  <Input id="nib" value={nib} onChange={(e) => setNib(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Nama penanggung jawab</Label>
                  <Input id="contact_person" value={contactPersonName} onChange={(e) => setContactPersonName(e.target.value)} />
                </div>
              </>
            )}
            <hr />
            <div className="space-y-2">
              <Label htmlFor="address">Alamat (jalan, no, RT/RW)</Label>
              <Input id="address" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kel">Kelurahan</Label>
                <Input id="kel" value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kec">Kecamatan</Label>
                <Input id="kec" value={kecamatan} onChange={(e) => setKecamatan(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Kota / Kabupaten</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prov">Provinsi</Label>
                <Input id="prov" value={province} onChange={(e) => setProvince(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal">Kode pos</Label>
              <Input id="postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
            <hr />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telepon</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditClientDialog({
  open,
  onOpenChange,
  clientId,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  token: string | null;
  onSuccess: () => void;
}) {
  const [client, setClient] = useState<ClientResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [nik, setNik] = useState('');
  const [npwp, setNpwp] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [religion, setReligion] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [occupation, setOccupation] = useState('');
  const [nationality, setNationality] = useState('WNI');
  const [establishmentDeedNumber, setEstablishmentDeedNumber] = useState('');
  const [establishmentDate, setEstablishmentDate] = useState('');
  const [nib, setNib] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!open || !token || !clientId) return;
    setLoading(true);
    getClientApi(token, clientId)
      .then((c) => {
        setClient(c);
        setFullName(c.full_name);
        setNik(c.nik ?? '');
        setNpwp(c.npwp ?? '');
        setPlaceOfBirth(c.place_of_birth ?? '');
        setDateOfBirth(c.date_of_birth ?? '');
        setGender(c.gender ?? '');
        setReligion(c.religion ?? '');
        setMaritalStatus(c.marital_status ?? '');
        setOccupation(c.occupation ?? '');
        setNationality(c.nationality ?? 'WNI');
        setEstablishmentDeedNumber(c.establishment_deed_number ?? '');
        setEstablishmentDate(c.establishment_date ?? '');
        setNib(c.nib ?? '');
        setContactPersonName(c.contact_person_name ?? '');
        setAddressLine(c.address_line ?? '');
        setKelurahan(c.kelurahan ?? '');
        setKecamatan(c.kecamatan ?? '');
        setCity(c.city ?? '');
        setProvince(c.province ?? '');
        setPostalCode(c.postal_code ?? '');
        setPhone(c.phone ?? '');
        setEmail(c.email ?? '');
      })
      .catch(() => setErr('Gagal memuat data klien'))
      .finally(() => setLoading(false));
  }, [open, token, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !client) return;
    if (!fullName.trim()) {
      setErr('Nama lengkap / nama badan hukum wajib.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const body: UpdateClientBody = {
        full_name: fullName.trim(),
        nik: nik.trim() || null,
        npwp: npwp.trim() || null,
        place_of_birth: placeOfBirth.trim() || null,
        date_of_birth: dateOfBirth.trim() || null,
        gender: gender || null,
        religion: religion.trim() || null,
        marital_status: maritalStatus.trim() || null,
        occupation: occupation.trim() || null,
        nationality: nationality.trim() || null,
        establishment_deed_number: establishmentDeedNumber.trim() || null,
        establishment_date: establishmentDate.trim() || null,
        nib: nib.trim() || null,
        contact_person_name: contactPersonName.trim() || null,
        address_line: addressLine.trim() || null,
        kelurahan: kelurahan.trim() || null,
        kecamatan: kecamatan.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        postal_code: postalCode.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      };
      await updateClientApi(token, clientId, body);
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal memperbarui klien');
    } finally {
      setSubmitting(false);
    }
  };

  if (!client && !loading && !err) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Klien</DialogTitle>
        </DialogHeader>
        {loading ? (
          <DialogBody><p className="text-muted-foreground">Memuat...</p></DialogBody>
        ) : err && !client ? (
          <DialogBody><p className="text-destructive">{err}</p></DialogBody>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogBody className="space-y-4">
              {err && <p className="text-sm text-destructive">{err}</p>}
              <p className="text-sm text-muted-foreground">Tipe: {client?.type === 'individual' ? 'Perorangan' : 'Badan Hukum'}</p>
              <div className="space-y-2">
                <Label htmlFor="edit_full_name">Nama *</Label>
                <Input id="edit_full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              {client?.type === 'individual' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>NIK</Label><Input value={nik} onChange={(e) => setNik(e.target.value)} /></div>
                    <div className="space-y-2"><Label>NPWP</Label><Input value={npwp} onChange={(e) => setNpwp(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Tempat lahir</Label><Input value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Tanggal lahir</Label><Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Jenis kelamin</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">Laki-laki</SelectItem>
                          <SelectItem value="P">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Agama</Label><Input value={religion} onChange={(e) => setReligion(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Status perkawinan</Label><Input value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Pekerjaan</Label><Input value={occupation} onChange={(e) => setOccupation(e.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label>Kewarganegaraan</Label><Input value={nationality} onChange={(e) => setNationality(e.target.value)} /></div>
                </>
              )}
              {client?.type === 'entity' && (
                <>
                  <div className="space-y-2"><Label>NPWP</Label><Input value={npwp} onChange={(e) => setNpwp(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>No. akta pendirian</Label><Input value={establishmentDeedNumber} onChange={(e) => setEstablishmentDeedNumber(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Tanggal akta</Label><Input type="date" value={establishmentDate} onChange={(e) => setEstablishmentDate(e.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label>NIB</Label><Input value={nib} onChange={(e) => setNib(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Nama penanggung jawab</Label><Input value={contactPersonName} onChange={(e) => setContactPersonName(e.target.value)} /></div>
                </>
              )}
              <hr />
              <div className="space-y-2"><Label>Alamat</Label><Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Kelurahan</Label><Input value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} /></div>
                <div className="space-y-2"><Label>Kecamatan</Label><Input value={kecamatan} onChange={(e) => setKecamatan(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Kota / Kabupaten</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
                <div className="space-y-2"><Label>Provinsi</Label><Input value={province} onChange={(e) => setProvince(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Kode pos</Label><Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></div>
              <hr />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Telepon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Menyimpan...' : 'Simpan'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
