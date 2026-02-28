'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientSearchSelect } from './client-search-select';
import { Users, Plus, Trash2 } from 'lucide-react';
import type { ClientResponse } from '@/lib/api';

export interface PartyRow {
  id: string;
  clientId: string;
  role: string;
}

export interface PartyListFieldProps {
  parties: PartyRow[];
  onPartiesChange: (parties: PartyRow[]) => void;
  roleOptions: readonly { value: string; label: string }[];
  defaultRole: string;
  clients: ClientResponse[];
  loadingClients: boolean;
  onAddClientForIndex: (index: number) => void;
  /** Label untuk section (default: Pihak dalam Akta) */
  sectionTitle?: string;
  /** Deskripsi opsional di bawah judul */
  sectionDescription?: string;
  /** Placeholder untuk select klien */
  clientPlaceholder?: string;
  /** Minimal jumlah baris (0 = boleh kosong) */
  minRows?: number;
}

export function PartyListField({
  parties,
  onPartiesChange,
  roleOptions,
  defaultRole,
  clients,
  loadingClients,
  onAddClientForIndex,
  sectionTitle = 'Pihak dalam Akta',
  sectionDescription,
  clientPlaceholder = 'Pilih klien',
  minRows = 0,
}: PartyListFieldProps) {
  const handlePartyChange = (index: number, field: 'clientId' | 'role', value: string) => {
    onPartiesChange(
      parties.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleRemove = (index: number) => {
    if (parties.length <= minRows) return;
    onPartiesChange(parties.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onPartiesChange([
      ...parties,
      { id: `party-${Date.now()}-${Math.random().toString(36).slice(2)}`, clientId: '', role: defaultRole },
    ]);
  };

  return (
    <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-muted-foreground" />
            {sectionTitle}
          </h3>
          {sectionDescription && (
            <p className="text-xs text-muted-foreground mt-1">{sectionDescription}</p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="shrink-0">
          <Plus className="size-4 me-1" />
          Tambah pihak
        </Button>
      </div>

      {parties.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center rounded-lg border border-dashed border-border">
          Belum ada pihak. Klik &quot;Tambah pihak&quot; untuk menambahkan.
        </p>
      ) : (
        <div className="space-y-4">
          {parties.map((party, index) => (
            <div
              key={party.id}
              className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-border bg-background/50"
            >
              <div className="flex-1 min-w-[180px] space-y-2">
                <Label className="text-xs">Klien</Label>
                <ClientSearchSelect
                  value={party.clientId}
                  onValueChange={(v) => handlePartyChange(index, 'clientId', v)}
                  clients={clients}
                  disabled={loadingClients}
                  placeholder={clientPlaceholder}
                  searchPlaceholder="Cari nama atau NIK..."
                  onAddClick={() => onAddClientForIndex(index)}
                />
              </div>
              <div className="w-[160px] shrink-0 space-y-2">
                <Label className="text-xs">Peran</Label>
                <Select
                  value={party.role || defaultRole}
                  onValueChange={(v) => handlePartyChange(index, 'role', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(index)}
                disabled={parties.length <= minRows}
                title="Hapus pihak"
                aria-label="Hapus pihak"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
