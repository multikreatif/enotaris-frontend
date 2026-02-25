'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  KanbanComponent,
  ColumnsDirective,
  ColumnDirective,
} from '@syncfusion/ej2-react-kanban';
import '@syncfusion/ej2-base/styles/tailwind.css';
import '@syncfusion/ej2-buttons/styles/tailwind.css';
import '@syncfusion/ej2-layouts/styles/tailwind.css';
import '@syncfusion/ej2-dropdowns/styles/tailwind.css';
import '@syncfusion/ej2-inputs/styles/tailwind.css';
import '@syncfusion/ej2-navigations/styles/tailwind.css';
import '@syncfusion/ej2-popups/styles/tailwind.css';
import '@syncfusion/ej2-react-kanban/styles/tailwind.css';
import {
  Toolbar,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import { getCasesApi, updateCaseApi } from '@/lib/api';
import type { CaseResponse, CaseStatus, CaseCategory } from '@/lib/api';
import { Loader2, UserCircle, CalendarCheck } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

/** Data item untuk Syncfusion Kanban (keyField = Status, card template pakai field ini). */
export interface KanbanCardData {
  Id: string;
  Status: CaseStatus;
  NamaKlien: string;
  NamaAkta: string;
  Singkatan: string;
  PicName: string;
  LastDoneAt: string;
  ProgressPercent: number;
}

function toKanbanData(cases: CaseResponse[]): KanbanCardData[] {
  return cases.map((c) => ({
    Id: c.id,
    Status: c.status,
    NamaKlien: c.nama_klien?.trim() || '—',
    NamaAkta: (c.jenis_akta?.trim() || c.nama_para_pihak?.trim() || c.nomor_draft || '—') as string,
    Singkatan: (c.jenis_pekerjaan_singkatan?.trim() || '') as string,
    PicName: (c.staf_penanggung_jawab_name?.trim() || '') as string,
    LastDoneAt: c.last_done_task_at
      ? format(new Date(c.last_done_task_at), 'dd MMM yyyy', { locale: id })
      : '',
    ProgressPercent: typeof c.progress_percent === 'number' ? c.progress_percent : 0,
  }));
}

/** Warna header per kolom (keyField) */
const COLUMN_HEAD_STYLE: Record<string, string> = {
  drafting: 'bg-blue-500/15 text-blue-800 dark:text-blue-200 border-blue-500/40',
  signed: 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40',
  registered: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40',
  closed: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40',
};

/** Template header kolom: judul besar dan menonjol. */
function ColumnHeaderTemplate(args: { headerText?: string; keyField?: string; count?: number }) {
  const key = (args.keyField ?? '') as string;
  const style = COLUMN_HEAD_STYLE[key] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300/50';
  return (
    <div className={`flex items-center justify-between w-full px-4 py-3.5 rounded-t-lg border-2 ${style}`}>
      <span className="text-base font-bold tracking-tight uppercase">{args.headerText ?? ''}</span>
      {args.count != null && (
        <span className="min-w-[28px] text-center text-sm font-semibold rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5">
          {args.count}
        </span>
      )}
    </div>
  );
}

/** Template kartu Syncfusion: Nama klien, Nama Akta/Berkas, badge singkatan, PIC, Diperbaharui; progress % sebagai badge kanan atas. */
function CardTemplate(props: KanbanCardData) {
  const pct = Math.min(100, Math.max(0, props.ProgressPercent));
  return (
    <div className="overflow-hidden relative">
      {/* Progress badge kanan atas */}
      <span className="absolute top-2 right-2 rounded-md bg-gradient-to-r from-blue-500 to-indigo-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm tabular-nums">
        {pct}%
      </span>
      {/* Accent strip */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />
      <div className="p-3.5 pr-10 space-y-3 text-left">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Nama klien</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate leading-tight" title={props.NamaKlien}>
            {props.NamaKlien}
          </p>
        </div>
        <div className="pl-2.5 border-l-2 border-blue-400/50 dark:border-blue-500/50">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Nama Akta / Berkas</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={props.NamaAkta}>
            {props.NamaAkta}
          </p>
        </div>
        {props.Singkatan && (
          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {props.Singkatan}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t border-gray-100 dark:border-gray-700/80">
          {props.PicName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <UserCircle className="size-3.5 shrink-0 text-blue-500" />
              <span className="truncate max-w-[120px]">{props.PicName}</span>
            </div>
          )}
          {props.LastDoneAt && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <CalendarCheck className="size-3.5 shrink-0 text-amber-500" />
              <span>Diperbaharui: {props.LastDoneAt}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CasesKanbanPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [cases, setCases] = useState<CaseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CaseCategory | ''>('');

  const fetchCases = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getCasesApi(token, {
        limit: 500,
        offset: 0,
        ...(category ? { category: category as CaseCategory } : {}),
        hide_closed_older_than_months: 2, // Arsip > 2 bulan tidak ditampilkan di Kanban
      });
      setCases(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat berkas');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [token, category]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const kanbanData = useMemo(() => toKanbanData(cases), [cases]);

  const handleActionComplete = useCallback(
    async (args: { requestType?: string; changedRecords?: KanbanCardData[] }) => {
      if (args.requestType !== 'cardChanged' || !args.changedRecords?.length || !token) return;
      for (const record of args.changedRecords) {
        try {
          await updateCaseApi(token, record.Id, { status: record.Status });
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Gagal mengubah status');
        }
      }
    },
    [token]
  );

  const handleCardClick = useCallback(
    (args: { data?: KanbanCardData }) => {
      const id = args.data?.Id;
      if (id) router.push(`/cases/${id}`);
    },
    [router]
  );

  if (loading) {
    return (
      <>
        <Toolbar>
          <ToolbarHeading title="Papan Kanban" description="Berkas akta menurut status." />
        </Toolbar>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-10 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title="Papan Kanban"
          description="Seret kartu ke kolom lain untuk mengubah status. Klik kartu untuk buka detail."
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Kategori:</span>
          <select
            value={category}
            onChange={(e) => setCategory((e.target.value || '') as CaseCategory | '')}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Semua</option>
            <option value="notaris">Notaris</option>
            <option value="ppat">PPAT</option>
          </select>
        </div>
      </Toolbar>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto overflow-y-hidden pb-2 -mx-2 px-2 scroll-smooth">
        <div className="min-w-[1200px]">
          <KanbanComponent
            id="berkas-kanban"
            keyField="Status"
            dataSource={kanbanData}
            cardSettings={{
              headerField: 'Id',
              showHeader: false,
              template: CardTemplate,
            }}
            actionComplete={handleActionComplete}
            cardClick={handleCardClick}
            enableTooltip={true}
            height="calc(100vh - 220px)"
          >
            <ColumnsDirective>
              <ColumnDirective headerText="Drafting" keyField="drafting" showAddButton={false} template={ColumnHeaderTemplate} />
              <ColumnDirective headerText="Tanda tangan" keyField="signed" showAddButton={false} template={ColumnHeaderTemplate} />
              <ColumnDirective headerText="Terdaftar" keyField="registered" showAddButton={false} template={ColumnHeaderTemplate} />
              <ColumnDirective headerText="Arsip" keyField="closed" showAddButton={false} template={ColumnHeaderTemplate} />
            </ColumnsDirective>
          </KanbanComponent>
        </div>
      </div>
    </>
  );
}
