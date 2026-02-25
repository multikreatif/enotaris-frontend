'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getClientsApi,
  getUsersApi,
  createClientApi,
  createCaseApi,
  getWorkflowTemplatesApi,
  getJenisPekerjaanApi,
  type ClientResponse,
  type CreateCaseBody,
  type CreateClientBody,
  type WorkflowTemplateItem,
  type JenisPekerjaanResponse,
} from '@/lib/api';
import type { UserResponse } from '@/lib/auth-types';
import { FileText, Users, UserCircle, MapPin, User } from 'lucide-react';
import { ClientSearchSelect } from './client-search-select';
import { UserSearchSelect } from './user-search-select';

export function CreatePPATCaseDialog({
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
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [nomorAkta, setNomorAkta] = useState('');
  const [tanggalAkta, setTanggalAkta] = useState('');
  const [primaryContactId, setPrimaryContactId] = useState('');
  const [pihakMengalihkanId, setPihakMengalihkanId] = useState('');
  const [pihakMenerimaId, setPihakMenerimaId] = useState('');
  const [jenisPekerjaan, setJenisPekerjaan] = useState('');
  const [stafId, setStafId] = useState('');
  const [luasTanah, setLuasTanah] = useState('');
  const [luasBangunan, setLuasBangunan] = useState('');
  const [hargaTransaksi, setHargaTransaksi] = useState<number | null>(null);
  const [njop, setNjop] = useState<number | null>(null);
  const [nop, setNop] = useState('');
  const [tahunNop, setTahunNop] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState<'primary' | 'mengalihkan' | 'menerima' | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [workflowTemplateId, setWorkflowTemplateId] = useState('');
  const [jenisPekerjaanList, setJenisPekerjaanList] = useState<JenisPekerjaanResponse[]>([]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoadingClients(true);
    try {
      const [c, u, t, jp] = await Promise.all([
        getClientsApi(token, { limit: 500 }),
        getUsersApi(token),
        getWorkflowTemplatesApi(token, { category: 'ppat' }),
        getJenisPekerjaanApi(token, { category: 'ppat' }),
      ]);
      setClients(c.data);
      setUsers(u);
      setTemplates(t);
      setJenisPekerjaanList(jp.filter((j) => j.active));
    } finally {
      setLoadingClients(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const jenisItem = jenisPekerjaanList.find((j) => j.id === jenisPekerjaan);
    if (!jenisItem) {
      setErr('Pilih jenis pekerjaan.');
      return;
    }
    if (!pihakMengalihkanId || !pihakMenerimaId) {
      setErr('Pilih klien pihak mengalihkan dan pihak menerima.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const parties: { client_id: string; role: string }[] = [];
      if (primaryContactId) {
        parties.push({ client_id: primaryContactId, role: 'primary_contact' });
      }
      parties.push(
        { client_id: pihakMengalihkanId, role: 'pihak_mengalihkan' },
        { client_id: pihakMenerimaId, role: 'pihak_menerima' },
      );
      const primaryName = primaryContactId ? clients.find((x) => x.id === primaryContactId)?.full_name : null;
      const mengalihkanName = clients.find((x) => x.id === pihakMengalihkanId)?.full_name;
      const menerimaName = clients.find((x) => x.id === pihakMenerimaId)?.full_name;
      const namaParaPihak = primaryName || mengalihkanName || menerimaName || undefined;
      const body: CreateCaseBody = {
        category: 'ppat',
        nomor_draft: nomorAkta.trim() || undefined,
        tanggal_mulai: tanggalAkta.trim() || undefined,
        nama_para_pihak: namaParaPihak,
        jenis_akta: jenisItem.name,
        jenis_pekerjaan_ppat: jenisItem.id,
        staf_penanggung_jawab_id: stafId || undefined,
        status: 'drafting',
        parties,
        workflow_template_id: workflowTemplateId.trim() || undefined,
        nilai_transaksi: hargaTransaksi ?? undefined,
        luas_tanah_m2: luasTanah ? parseFloat(luasTanah) : undefined,
        luas_bangunan_m2: luasBangunan ? parseFloat(luasBangunan) : undefined,
        njop: njop ?? undefined,
        nop: nop.trim() || undefined,
        tahun_nop: tahunNop.trim() || undefined,
      };
      await createCaseApi(token, body);
      setNomorAkta('');
      setTanggalAkta('');
      setPrimaryContactId('');
      setPihakMengalihkanId('');
      setPihakMenerimaId('');
      setJenisPekerjaan('');
      setStafId('');
      setWorkflowTemplateId('');
      setLuasTanah('');
      setLuasBangunan('');
      setHargaTransaksi(null);
      setNjop(null);
      setNop('');
      setTahunNop('');
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan berkas');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClientCreated = (newClientId: string) => {
    setAddClientOpen(null);
    loadData();
    if (addClientOpen === 'primary') setPrimaryContactId(newClientId);
    if (addClientOpen === 'mengalihkan') setPihakMengalihkanId(newClientId);
    if (addClientOpen === 'menerima') setPihakMenerimaId(newClientId);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tambah Berkas Akta PPAT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <DialogBody className="space-y-6">
              {err && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {err}
                </div>
              )}

              {/* Section: Klien (Primary contact) — paling atas, terpisah */}
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <User className="size-4 text-muted-foreground" />
                  Klien (Primary contact)
                </h3>
                <p className="text-xs text-muted-foreground">Kontak utama untuk perkara ini</p>
                <ClientSearchSelect
                  value={primaryContactId}
                  onValueChange={setPrimaryContactId}
                  clients={clients}
                  disabled={loadingClients}
                  placeholder="Pilih klien"
                  searchPlaceholder="Cari nama atau NIK..."
                  onAddClick={() => setAddClientOpen('primary')}
                />
              </section>

              {/* Section: Identitas Akta */}
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="size-4 text-muted-foreground" />
                  Identitas Akta
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nomor_akta">Nomor akta</Label>
                    <Input
                      id="nomor_akta"
                      value={nomorAkta}
                      onChange={(e) => setNomorAkta(e.target.value)}
                      placeholder="Contoh: 01/AJB/2025"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_akta">Tanggal akta</Label>
                    <Input
                      id="tanggal_akta"
                      type="date"
                      value={tanggalAkta}
                      onChange={(e) => setTanggalAkta(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Jenis pekerjaan *</Label>
                  <Select value={jenisPekerjaan} onValueChange={setJenisPekerjaan} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis pekerjaan" />
                    </SelectTrigger>
                    <SelectContent>
                      {jenisPekerjaanList.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.name}
                          {j.biaya != null ? ` — ${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(j.biaya)}` : ''}
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
              </section>

              {/* Section: Pihak dalam Akta */}
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="size-4 text-muted-foreground" />
                  Pihak dalam Akta
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pihak yang mengalihkan</Label>
                    <ClientSearchSelect
                      value={pihakMengalihkanId}
                      onValueChange={setPihakMengalihkanId}
                      clients={clients}
                      disabled={loadingClients}
                      placeholder="Pilih klien"
                      searchPlaceholder="Cari nama atau NIK..."
                      onAddClick={() => setAddClientOpen('mengalihkan')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pihak yang menerima</Label>
                    <ClientSearchSelect
                      value={pihakMenerimaId}
                      onValueChange={setPihakMenerimaId}
                      clients={clients}
                      disabled={loadingClients}
                      placeholder="Pilih klien"
                      searchPlaceholder="Cari nama atau NIK..."
                      onAddClick={() => setAddClientOpen('menerima')}
                    />
                  </div>
                </div>
              </section>

              {/* Section: Penanggung jawab */}
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserCircle className="size-4 text-muted-foreground" />
                  Penanggung jawab
                </h3>
                <div className="space-y-2">
                  <Label>Person in charge (staf)</Label>
                  <UserSearchSelect
                    value={stafId}
                    onValueChange={setStafId}
                    users={users.filter((u) => (u.role_name ?? '').toLowerCase() === 'staff')}
                    placeholder="Pilih staf yang menangani"
                    searchPlaceholder="Cari nama atau email..."
                  />
                </div>
              </section>

              {/* Section: Objek & nilai */}
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPin className="size-4 text-muted-foreground" />
                  Objek dan nilai
                </h3>
                <p className="text-xs text-muted-foreground">Luas, nilai transaksi, dan data pajak (opsional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="luas_tanah">Luas tanah (m²)</Label>
                    <Input
                      id="luas_tanah"
                      type="number"
                      step="any"
                      min="0"
                      value={luasTanah}
                      onChange={(e) => setLuasTanah(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="luas_bangunan">Luas bangunan (m²)</Label>
                    <Input
                      id="luas_bangunan"
                      type="number"
                      step="any"
                      min="0"
                      value={luasBangunan}
                      onChange={(e) => setLuasBangunan(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="harga_transaksi">Harga transaksi (Rp)</Label>
                  <CurrencyInput
                    id="harga_transaksi"
                    value={hargaTransaksi}
                    onChange={setHargaTransaksi}
                    placeholder="0"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="njop">NJOP (Rp)</Label>
                    <CurrencyInput
                      id="njop"
                      value={njop}
                      onChange={setNjop}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nop">NOP</Label>
                    <Input id="nop" value={nop} onChange={(e) => setNop(e.target.value)} placeholder="Nomor objek pajak" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tahun_nop">Tahun NOP</Label>
                    <Input id="tahun_nop" value={tahunNop} onChange={(e) => setTahunNop(e.target.value)} placeholder="2025" />
                  </div>
                </div>
              </section>
            </DialogBody>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan berkas'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddClientDialog
        open={addClientOpen !== null}
        onOpenChange={(open) => !open && setAddClientOpen(null)}
        token={token}
        onCreated={handleClientCreated}
      />
    </>
  );
}

function AddClientDialog({
  open,
  onOpenChange,
  token,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  onCreated: (clientId: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [type, setType] = useState<'individual' | 'entity'>('individual');
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

  const reset = () => {
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
  };

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
      const created = await createClientApi(token, body);
      reset();
      onCreated(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menambah klien');
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
              <Select value={type} onValueChange={(v) => setType(v as 'individual' | 'entity')}>
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
              <Label htmlFor="ac_full_name">{type === 'individual' ? 'Nama lengkap' : 'Nama badan hukum'} *</Label>
              <Input
                id="ac_full_name"
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
                    <Label htmlFor="ac_nik">NIK</Label>
                    <Input id="ac_nik" value={nik} onChange={(e) => setNik(e.target.value)} placeholder="16 digit" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ac_npwp">NPWP</Label>
                    <Input id="ac_npwp" value={npwp} onChange={(e) => setNpwp(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ac_place_of_birth">Tempat lahir</Label>
                    <Input
                      id="ac_place_of_birth"
                      value={placeOfBirth}
                      onChange={(e) => setPlaceOfBirth(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ac_date_of_birth">Tanggal lahir</Label>
                    <Input
                      id="ac_date_of_birth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jenis kelamin</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ac_religion">Agama</Label>
                    <Input id="ac_religion" value={religion} onChange={(e) => setReligion(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ac_marital">Status perkawinan</Label>
                    <Input
                      id="ac_marital"
                      value={maritalStatus}
                      onChange={(e) => setMaritalStatus(e.target.value)}
                      placeholder="Kawin / Belum kawin / Cerai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ac_occupation">Pekerjaan</Label>
                    <Input
                      id="ac_occupation"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac_nationality">Kewarganegaraan</Label>
                  <Input
                    id="ac_nationality"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                  />
                </div>
              </>
            )}
            {type === 'entity' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ac_npwp_ent">NPWP</Label>
                  <Input id="ac_npwp_ent" value={npwp} onChange={(e) => setNpwp(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ac_akta">No. akta pendirian</Label>
                    <Input
                      id="ac_akta"
                      value={establishmentDeedNumber}
                      onChange={(e) => setEstablishmentDeedNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ac_tgl_akta">Tanggal akta</Label>
                    <Input
                      id="ac_tgl_akta"
                      type="date"
                      value={establishmentDate}
                      onChange={(e) => setEstablishmentDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac_nib">NIB</Label>
                  <Input id="ac_nib" value={nib} onChange={(e) => setNib(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ac_contact_person">Nama penanggung jawab</Label>
                  <Input
                    id="ac_contact_person"
                    value={contactPersonName}
                    onChange={(e) => setContactPersonName(e.target.value)}
                  />
                </div>
              </>
            )}
            <hr />
            <div className="space-y-2">
              <Label htmlFor="ac_address">Alamat (jalan, no, RT/RW)</Label>
              <Input
                id="ac_address"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ac_kel">Kelurahan</Label>
                <Input id="ac_kel" value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ac_kec">Kecamatan</Label>
                <Input id="ac_kec" value={kecamatan} onChange={(e) => setKecamatan(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ac_city">Kota / Kabupaten</Label>
                <Input id="ac_city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ac_prov">Provinsi</Label>
                <Input id="ac_prov" value={province} onChange={(e) => setProvince(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ac_postal">Kode pos</Label>
              <Input id="ac_postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
            <hr />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ac_phone">Telepon</Label>
                <Input id="ac_phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ac_email">Email</Label>
                <Input id="ac_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
