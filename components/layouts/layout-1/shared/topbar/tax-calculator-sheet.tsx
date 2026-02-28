'use client';

import { ReactNode, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const NPOPTKP_DEFAULT = 60_000_000; // Rp 60 juta (contoh, bervariasi per daerah)
const TARIF_BPHTB = 0.05; // 5%
const TARIF_PPH_FINAL = 0.025; // 2,5% (WPDN pengalihan tanah/bangunan)
const TARIF_PBB_NJKP = 0.2; // 20% NJOP sebagai NJKP (contoh)
const TARIF_PBB = 0.005; // 0,5% dari NJKP

function formatRupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Parse input: pemisah ribuan (.) diabaikan, koma (,) sebagai desimal. Contoh: "500.000.000,50" → 500000000.5 */
function parseNumericInput(value: string): number {
  const t = value.trim().replace(/\s/g, '');
  if (!t) return 0;
  const parts = t.split(',');
  const intPart = (parts[0] ?? '').replace(/\D/g, '');
  const decPart = (parts[1] ?? '').replace(/\D/g, '').slice(0, 2);
  const numStr = decPart ? `${intPart}.${decPart}` : intPart;
  return numStr ? parseFloat(numStr) : 0;
}

/** Format angka untuk ditampilkan di input: ribuan pakai titik, desimal pakai koma (format Indonesia). */
function formatNumberForInput(n: number): string {
  if (Number.isNaN(n) || n === 0) return '';
  const hasDecimal = n % 1 !== 0;
  const intPart = Math.floor(Math.abs(n));
  const decPart = hasDecimal ? (Math.round((Math.abs(n) % 1) * 100) / 100).toFixed(2).slice(1) : '';
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + intStr + decPart.replace('.', ',');
}

/** Format input sambil ketik: delimiter ribuan (.) otomatis, koma untuk desimal. Mempertahankan koma di akhir bila user baru ketik koma. */
function formatInputLive(value: string): string {
  const trimmed = value.replace(/\s/g, '');
  const hasTrailingComma = /,\s*$/.test(trimmed);
  const parts = trimmed.split(',');
  let intPart = (parts[0] ?? '').replace(/\D/g, '');
  if (intPart.length > 1) intPart = intPart.replace(/^0+/, '');
  const decPart = (parts[1] ?? '').replace(/\D/g, '').slice(0, 2);
  const intFormatted = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  if (!intFormatted && !decPart && !hasTrailingComma) return '';
  return decPart || hasTrailingComma ? `${intFormatted},${decPart}` : intFormatted;
}

export function TaxCalculatorSheet({ trigger }: { trigger: ReactNode }) {
  const [nilaiTransaksiRaw, setNilaiTransaksiRaw] = useState('');
  const [npoptkpRaw, setNpoptkpRaw] = useState(() => formatNumberForInput(NPOPTKP_DEFAULT));

  const nilaiTransaksi = useMemo(
    () => parseNumericInput(nilaiTransaksiRaw),
    [nilaiTransaksiRaw],
  );
  const npoptkp = useMemo(() => parseNumericInput(npoptkpRaw), [npoptkpRaw]);

  const hasil = useMemo(() => {
    if (nilaiTransaksi <= 0) {
      return { bphtb: 0, pphFinal: 0, pbbTahunan: 0, total: 0 };
    }
    const npop = nilaiTransaksi;
    const bphtb = Math.max(0, (npop - npoptkp) * TARIF_BPHTB);
    const pphFinal = nilaiTransaksi * TARIF_PPH_FINAL;
    const njkp = nilaiTransaksi * TARIF_PBB_NJKP;
    const pbbTahunan = njkp * TARIF_PBB;
    return {
      bphtb,
      pphFinal,
      pbbTahunan,
      total: bphtb + pphFinal,
    };
  }, [nilaiTransaksi, npoptkp]);

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 sm:w-[420px] sm:max-w-[95vw] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="size-5" />
            Kalkulator Pajak
          </SheetTitle>
        </SheetHeader>
        <SheetBody className="pt-6">
          <p className="text-xs text-muted-foreground mb-4">
            Perkiraan BPHTB, PPh Final pengalihan, dan estimasi PBB. NPOPTKP bervariasi per daerah.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nilai-transaksi">Nilai transaksi / NJOP (Rp)</Label>
              <Input
                id="nilai-transaksi"
                type="text"
                inputMode="decimal"
                placeholder="Contoh: 500.000.000 atau 500.000.000,50"
                value={nilaiTransaksiRaw}
                onChange={(e) => setNilaiTransaksiRaw(formatInputLive(e.target.value))}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pemisah ribuan (.) dan desimal (,) otomatis
              </p>
            </div>
            <div>
              <Label htmlFor="npoptkp">NPOPTKP (Rp)</Label>
              <Input
                id="npoptkp"
                type="text"
                inputMode="decimal"
                placeholder="Contoh: 60.000.000"
                value={npoptkpRaw}
                onChange={(e) => setNpoptkpRaw(formatInputLive(e.target.value))}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nilai tidak kena pajak (contoh: DKI 80.000.000, banyak daerah 60.000.000)
              </p>
            </div>
          </div>

          {nilaiTransaksi > 0 && (
            <div className="mt-6 pt-4 border-t border-border space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">BPHTB (5%)</span>
                <span className="font-medium">{formatRupiah(hasil.bphtb)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">PPh Final (2,5%)</span>
                <span className="font-medium">{formatRupiah(hasil.pphFinal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimasi PBB tahunan</span>
                <span className="font-medium">{formatRupiah(hasil.pbbTahunan)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 font-semibold text-primary">
                <span>Total (BPHTB + PPh)</span>
                <span>{formatRupiah(hasil.total)}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-6">
            Hasil perhitungan hanya perkiraan. Konfirmasi ke KPP/BPKD setempat.
          </p>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
