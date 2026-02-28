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
  getDocumentRequirementTemplatesApi,
  getJenisPekerjaanApi,
  type ClientResponse,
  type CreateCaseBody,
  type CreateClientBody,
  type WorkflowTemplateItem,
  type DocumentRequirementTemplateResponse,
  type JenisPekerjaanResponse,
} from '@/lib/api';
import type { UserResponse } from '@/lib/auth-types';
import { FileText, UserCircle } from 'lucide-react';
import { PartyListField, type PartyRow } from './party-list-field';
import { UserSearchSelect } from './user-search-select';

const NOTARIS_PARTY_ROLES = [
  { value: 'primary_contact', label: 'Kontak utama' },
  { value: 'pihak_pertama', label: 'Pihak pertama' },
  { value: 'pihak_kedua', label: 'Pihak kedua' },
  { value: 'pemberi_kuasa', label: 'Pemberi kuasa' },
  { value: 'penerima_kuasa', label: 'Penerima kuasa' },
  { value: 'saksi', label: 'Saksi' },
  { value: 'lainnya', label: 'Lainnya' },
] as const;

export function CreateNotarisCaseDialog({
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
  const [nomorDraft, setNomorDraft] = useState('');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [targetSelesai, setTargetSelesai] = useState('');
  const [jenisPekerjaanId, setJenisPekerjaanId] = useState('');
  const [stafId, setStafId] = useState('');
  const [namaParaPihak, setNamaParaPihak] = useState('');
  const [nilaiTransaksi, setNilaiTransaksi] = useState<number | null>(null);
  const [taskNamesText, setTaskNamesText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState<number | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [workflowTemplateId, setWorkflowTemplateId] = useState('');
  const [docTemplates, setDocTemplates] = useState<DocumentRequirementTemplateResponse[]>([]);
  const [documentTemplateId, setDocumentTemplateId] = useState('');
  const [jenisPekerjaanList, setJenisPekerjaanList] = useState<JenisPekerjaanResponse[]>([]);

  const [parties, setParties] = useState<PartyRow[]>([]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoadingClients(true);
    try {
      const [c, u, t, dt, jp] = await Promise.all([
        getClientsApi(token, { limit: 500 }),
        getUsersApi(token),
        getWorkflowTemplatesApi(token, { category: 'notaris' }),
        getDocumentRequirementTemplatesApi(token, { category: 'notaris' }),
        getJenisPekerjaanApi(token, { category: 'notaris' }),
      ]);
      setClients(c.data);
      setUsers(u);
      setTemplates(t);
      setDocTemplates(dt);
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
    const jenisItem = jenisPekerjaanList.find((j) => j.id === jenisPekerjaanId);
    if (!jenisItem) {
      setErr('Pilih jenis akta.');
      return;
    }
    const partiesPayload = parties
      .filter((p) => p.clientId.trim() !== '')
      .map((p) => ({ client_id: p.clientId, role: p.role || 'lainnya' }));
    const names = parties
      .filter((p) => p.clientId)
      .map((p) => clients.find((x) => x.id === p.clientId)?.full_name)
      .filter(Boolean) as string[];
    const namaParaPihakFinal = namaParaPihak.trim() || names.join(', ') || undefined;

    setSubmitting(true);
    setErr(null);
    try {
      const task_names = taskNamesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const body: CreateCaseBody = {
        category: 'notaris',
        nomor_draft: nomorDraft.trim() || undefined,
        tanggal_mulai: tanggalMulai.trim() || undefined,
        target_selesai: targetSelesai.trim() || undefined,
        nama_para_pihak: namaParaPihakFinal,
        jenis_akta: jenisItem.name,
        staf_penanggung_jawab_id: stafId || undefined,
        status: 'drafting',
        parties: partiesPayload.length > 0 ? partiesPayload : undefined,
        task_names: task_names.length > 0 ? task_names : undefined,
        workflow_template_id: workflowTemplateId.trim() || undefined,
        document_requirement_template_id: documentTemplateId.trim() || undefined,
        nilai_transaksi: nilaiTransaksi ?? undefined,
      };
      await createCaseApi(token, body);
      setNomorDraft('');
      setTanggalMulai('');
      setTargetSelesai('');
      setParties([]);
      setJenisPekerjaanId('');
      setStafId('');
      setNamaParaPihak('');
      setNilaiTransaksi(null);
      setTaskNamesText('');
      setWorkflowTemplateId('');
      setDocumentTemplateId('');
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan berkas');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClientCreated = (newClientId: string) => {
    const idx = addClientOpen;
    setAddClientOpen(null);
    loadData();
    if (typeof idx === 'number' && idx >= 0) {
      setParties((prev) =>
        prev.map((p, i) => (i === idx ? { ...p, clientId: newClientId } : p))
      );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entri Berkas Akta (Notaris)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <DialogBody className="space-y-6">
              {err && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {err}
                </div>
              )}

              {/* Section: Identitas Akta */}
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="size-4 text-muted-foreground" />
                  Identitas Akta
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nomor_draft">Nomor draft</Label>
                    <Input
                      id="nomor_draft"
                      value={nomorDraft}
                      onChange={(e) => setNomorDraft(e.target.value)}
                      placeholder="Contoh: 01/KW/2025"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tanggal_mulai">Tanggal mulai</Label>
                    <Input
                      id="tanggal_mulai"
                      type="date"
                      value={tanggalMulai}
                      onChange={(e) => setTanggalMulai(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Jenis akta *</Label>
                  <Select value={jenisPekerjaanId} onValueChange={setJenisPekerjaanId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis akta (Notaris)" />
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
                <div className="space-y-2">
                  <Label>Template dokumen persyaratan (opsional)</Label>
                  <Select value={documentTemplateId || '_none'} onValueChange={(v) => setDocumentTemplateId(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tanpa template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Tanpa template</SelectItem>
                      {docTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} {t.jenis_pekerjaan ? `(${t.jenis_pekerjaan})` : ''} — {t.items?.length ?? 0} dokumen
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Tab Dokumen di berkas ini akan menampilkan daftar persyaratan dari template yang dipilih.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nama_para_pihak">Nama para pihak (ringkasan)</Label>
                  <Input
                    id="nama_para_pihak"
                    value={namaParaPihak}
                    onChange={(e) => setNamaParaPihak(e.target.value)}
                    placeholder="Contoh: Budi Santoso dengan PT ABC — otomatis dari pihak di bawah jika kosong"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_selesai">Target selesai (opsional)</Label>
                  <Input
                    id="target_selesai"
                    type="date"
                    value={targetSelesai}
                    onChange={(e) => setTargetSelesai(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nilai_transaksi">Nilai transaksi (Rp, opsional)</Label>
                  <CurrencyInput
                    id="nilai_transaksi"
                    value={nilaiTransaksi}
                    onChange={setNilaiTransaksi}
                    placeholder="0"
                  />
                </div>
              </section>

              <PartyListField
                parties={parties}
                onPartiesChange={setParties}
                roleOptions={NOTARIS_PARTY_ROLES}
                defaultRole="pihak_pertama"
                clients={clients}
                loadingClients={loadingClients}
                onAddClientForIndex={(index) => setAddClientOpen(index)}
                sectionTitle="Pihak dalam Akta"
                sectionDescription="Tambahkan pihak-pihak yang terlibat dalam akta. Klik Tambah pihak untuk menambah baris."
                clientPlaceholder="Pilih klien"
                minRows={0}
              />

              {/* Section: Penanggung jawab */}
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <UserCircle className="size-4 text-muted-foreground" />
                  Penanggung jawab
                </h3>
                <div className="space-y-2">
                  <Label>Staf penanggung jawab (PIC)</Label>
                  <UserSearchSelect
                    value={stafId}
                    onValueChange={setStafId}
                    users={users.filter((u) => (u.role_name ?? '').toLowerCase() === 'staff')}
                    placeholder="Pilih staf yang menangani"
                    searchPlaceholder="Cari nama atau email..."
                  />
                </div>
              </section>

              {/* Section: Tahapan (jika tidak pakai template workflow) */}
              <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Tahapan (opsional)</h3>
                <p className="text-xs text-muted-foreground">Satu tahapan per baris. Kosongkan jika menggunakan template workflow.</p>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={taskNamesText}
                  onChange={(e) => setTaskNamesText(e.target.value)}
                  placeholder="Terima dokumen&#10;Draft akta&#10;Tanda tangan&#10;Arsip minuta"
                />
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
