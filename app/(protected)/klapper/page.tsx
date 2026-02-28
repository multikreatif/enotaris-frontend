'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Toolbar,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import { getKlapperApi, type KlapperEntry } from '@/lib/api';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function KlapperPage() {
  const { token } = useAuth();
  const [letter, setLetter] = useState<string>('');
  const [entries, setEntries] = useState<KlapperEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { data, total: t } = await getKlapperApi(token, {
        letter: letter || undefined,
        limit,
        offset,
      });
      setEntries(data);
      setTotal(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat Buku Klapper');
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, letter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title={
            <span className="inline-flex items-center gap-2">
              <FileText className="size-5" />
              <span>Buku Klapper</span>
            </span>
          }
          description="Indeks abjad pihak dalam akta Notaris. Data terisi otomatis saat akta masuk Repertorium."
        />
      </Toolbar>

      <div className="container space-y-6 pb-10">
        {/* Index abjad */}
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">
            Index abjad
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setLetter('');
                setOffset(0);
              }}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                letter === ''
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              )}
            >
              Semua
            </button>
            {LETTERS.map((L) => (
              <button
                key={L}
                type="button"
                onClick={() => {
                  setLetter(L);
                  setOffset(0);
                }}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors min-w-[2rem]',
                  letter === L
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                )}
              >
                {L}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="kt-card flex flex-col">
          <div className="kt-card-body flex flex-col gap-4 p-6">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Memuat data Buku Klapper...
              </p>
            ) : entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {letter
                  ? `Tidak ada entri dengan awalan &quot;${letter}&quot;.`
                  : 'Belum ada entri Buku Klapper. Entri terisi otomatis ketika akta Notaris ditambahkan ke Repertorium.'}
              </p>
            ) : (
              <>
                <div className="kt-card-table">
                  <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
                    <table className="kt-table w-full align-middle">
                      <thead>
                        <tr>
                          <th scope="col">
                            <span className="kt-table-col">
                              <span className="kt-table-col-label">Nama</span>
                            </span>
                          </th>
                          <th scope="col">
                            <span className="kt-table-col">
                              <span className="kt-table-col-label">Peran</span>
                            </span>
                          </th>
                          <th scope="col">
                            <span className="kt-table-col">
                              <span className="kt-table-col-label">No Repertorium</span>
                            </span>
                          </th>
                          <th scope="col">
                            <span className="kt-table-col">
                              <span className="kt-table-col-label">Tahun</span>
                            </span>
                          </th>
                          <th scope="col">
                            <span className="kt-table-col">
                              <span className="kt-table-col-label">Jenis</span>
                            </span>
                          </th>
                          <th scope="col">
                            <span className="kt-table-col">
                              <span className="kt-table-col-label">Berkas</span>
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((row) => (
                          <tr
                            key={row.id}
                            className="hover:bg-muted/60"
                          >
                            <td className="font-medium">{row.name_display}</td>
                            <td className="text-muted-foreground">{row.role}</td>
                            <td>{row.repertorium_number}</td>
                            <td>{row.year}</td>
                            <td>{row.jenis}</td>
                            <td>
                              <Link
                                href={`/cases/${row.case_id}`}
                                className="text-primary hover:underline"
                              >
                                Lihat berkas
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {total > limit && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      Menampilkan {offset + 1}–{Math.min(offset + limit, total)} dari {total} entri
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOffset((o) => Math.max(0, o - limit))}
                        disabled={offset === 0}
                        className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
                      >
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        onClick={() => setOffset((o) => o + limit)}
                        disabled={offset + limit >= total}
                        className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
