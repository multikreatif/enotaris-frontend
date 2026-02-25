'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Toolbar,
  ToolbarHeading,
  ToolbarActions,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import {
  getCurrentOfficeApi,
  updateOfficeApi,
  type UpdateOfficeBody,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Building2, User, Save } from 'lucide-react';

const emptyStr = (v: string | null | undefined) => v ?? '';
const FORM_ID = 'form-profile-notaris';

export default function ProfileNotarisPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [namaNotaris, setNamaNotaris] = useState('');
  const [skNotaris, setSkNotaris] = useState('');
  const [npwp, setNpwp] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const isAdmin = user?.role_name === 'admin';

  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCurrentOfficeApi(token);
      setName(emptyStr(data.name));
      setAddress(emptyStr(data.address));
      setNamaNotaris(emptyStr(data.nama_notaris));
      setSkNotaris(emptyStr(data.sk_notaris));
      setNpwp(emptyStr(data.npwp));
      setPhone(emptyStr(data.phone));
      setEmail(emptyStr(data.email));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat profile kantor');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    loadProfile();
  }, [isAdmin, router, loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    const body: UpdateOfficeBody = {
      name: name.trim(),
      address: address.trim(),
      nama_notaris: namaNotaris.trim() || undefined,
      sk_notaris: skNotaris.trim() || undefined,
      npwp: npwp.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    };
    try {
      await updateOfficeApi(token, body);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title="Update Profile Notaris & PPAT"
          description="Data kantor serta informasi pejabat notaris dan PPAT"
        />
        {!loading && (
          <ToolbarActions>
            <Button
              type="submit"
              form={FORM_ID}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="me-2 size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="me-2 size-4" />
                  Simpan
                </>
              )}
            </Button>
          </ToolbarActions>
        )}
      </Toolbar>

      <div className="container-fluid px-4 sm:px-6 lg:px-8 pb-8">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
          >
            Profile kantor berhasil disimpan.
          </div>
        )}

        {loading ? (
          <div className="kt-card flex min-h-[320px] items-center justify-center">
            <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : (
          <form id={FORM_ID} onSubmit={handleSubmit} className="grid w-full gap-5 lg:grid-cols-2">
            {/* Data Kantor */}
            <div className="kt-card flex flex-col">
              <div className="kt-card-header flex flex-row items-center gap-4 py-4 min-h-14 border-b border-border px-6">
                <Building2 className="size-5 shrink-0 text-primary" aria-hidden />
                <h2 className="text-base font-semibold">Data Kantor</h2>
              </div>
              <div className="kt-card-body flex flex-col gap-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Nama Kantor</Label>
                  <Input
                    id="profile-name"
                    className="kt-input w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama kantor notaris / PPAT"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-address">Alamat</Label>
                  <textarea
                    id="profile-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Alamat lengkap kantor"
                    rows={4}
                    className="kt-input w-full min-h-[100px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>
            </div>

            {/* Informasi Notaris & PPAT */}
            <div className="kt-card flex flex-col">
              <div className="kt-card-header flex flex-row items-center gap-4 py-4 min-h-14 border-b border-border px-6">
                <User className="size-5 shrink-0 text-primary" aria-hidden />
                <h2 className="text-base font-semibold">Informasi Notaris & PPAT</h2>
              </div>
              <div className="kt-card-body flex flex-col gap-4 p-6">
                <p className="text-sm text-muted-foreground -mt-1">
                  Data pejabat dan identitas kantor untuk Notaris maupun PPAT.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-nama-notaris">Nama Notaris / PPAT</Label>
                    <Input
                      id="profile-nama-notaris"
                      className="kt-input w-full"
                      value={namaNotaris}
                      onChange={(e) => setNamaNotaris(e.target.value)}
                      placeholder="Nama pejabat notaris atau PPAT"
                    />
                    <p className="text-xs text-muted-foreground">Nama lengkap pejabat yang berwenang.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-sk">Nomor SK Notaris / SK PPAT</Label>
                    <Input
                      id="profile-sk"
                      className="kt-input w-full"
                      value={skNotaris}
                      onChange={(e) => setSkNotaris(e.target.value)}
                      placeholder="Nomor SK Notaris atau SK PPAT"
                    />
                    <p className="text-xs text-muted-foreground">Surat Keputusan pengangkatan.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-npwp">NPWP Kantor</Label>
                    <Input
                      id="profile-npwp"
                      className="kt-input w-full"
                      value={npwp}
                      onChange={(e) => setNpwp(e.target.value)}
                      placeholder="NPWP kantor notaris/PPAT"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">Telepon Kantor</Label>
                    <Input
                      id="profile-phone"
                      type="tel"
                      className="kt-input w-full"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Nomor telepon kantor"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email Kantor</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    className="kt-input w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email kantor notaris/PPAT"
                  />
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
