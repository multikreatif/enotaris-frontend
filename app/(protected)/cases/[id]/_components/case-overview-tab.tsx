'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FileText,
  User,
  Users,
  ListTodo,
  History,
  Workflow,
  Calendar,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Plus,
  Clock,
} from 'lucide-react';
import type { CaseResponse } from '@/lib/api';
import type { TaskResponse } from '@/lib/api';
import type { CasePartyItem } from '@/lib/api';
import type { ScheduleEventItem } from '@/lib/api';

type TimelineEvent = {
  id: string;
  at: string;
  label: string;
  type: 'case_created' | 'task_created' | 'task_updated';
  actor?: string;
};

function daysUntilTarget(targetSelesai: string | null | undefined): number | null {
  if (!targetSelesai) return null;
  const target = new Date(targetSelesai);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface CaseOverviewTabProps {
  caseData: CaseResponse;
  tasks: TaskResponse[];
  caseParties: CasePartyItem[];
  scheduleEvents: ScheduleEventItem[];
  timeline: TimelineEvent[];
  userNames: Record<string, string>;
  displayJenisTitle: string;
  displayJenisPekerjaanPpat: string;
  picName: string;
  STATUS_LABELS: Record<string, string>;
  formatDateKey: (iso: string) => string;
  formatTime: (iso: string) => string;
  roleToLabel: (role: string) => string;
  onSetActiveTab: (tab: string) => void;
  onOpenAddTask: () => void;
  onOpenApplyTemplate: () => void;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  plotting: 'Plotting',
  tanda_tangan_akad: 'TTA',
  batas_pajak: 'Batas pajak',
  lainnya: 'Lainnya',
};

export function CaseOverviewTab({
  caseData,
  tasks,
  caseParties,
  scheduleEvents,
  timeline,
  picName,
  displayJenisTitle,
  displayJenisPekerjaanPpat,
  STATUS_LABELS,
  formatDateKey,
  formatTime,
  roleToLabel,
  onSetActiveTab,
  onOpenAddTask,
  onOpenApplyTemplate,
}: CaseOverviewTabProps) {
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const progressPct = tasks.length ? Math.round((100 * doneCount) / tasks.length) : 0;
  const currentTask = tasks.find((t) => t.status === 'in_progress') ?? tasks.find((t) => t.status === 'todo' || t.status === 'waiting');
  const daysLeft = daysUntilTarget(caseData.target_selesai ?? undefined);
  const upcomingEvents = scheduleEvents
    .filter((e) => new Date(e.start_at) >= new Date())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Hero: identitas berkas + status + urgency + quick nav */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {displayJenisTitle}
            </h1>
            {caseData.nomor_draft && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                No. {caseData.nomor_draft}
              </p>
            )}
            {caseData.nama_para_pihak && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {caseData.nama_para_pihak}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
                caseData.status === 'closed' && 'bg-muted text-muted-foreground',
                caseData.status === 'registered' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400',
                caseData.status === 'signed' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400',
                (caseData.status === 'drafting' || !caseData.status) && 'bg-primary/10 text-primary'
              )}
            >
              {STATUS_LABELS[caseData.status] ?? caseData.status}
            </span>
            {picName !== '-' && (
              <span className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                <User className="size-3.5 shrink-0" />
                {picName}
              </span>
            )}
            {daysLeft !== null && caseData.status !== 'closed' && (
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
                  daysLeft < 0
                    ? 'bg-destructive/10 text-destructive'
                    : daysLeft <= 7
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
                      : 'bg-muted/60 text-muted-foreground'
                )}
              >
                {daysLeft < 0 ? (
                  <>
                    <AlertCircle className="size-3.5" />
                    Terlambat {Math.abs(daysLeft)} hari
                  </>
                ) : daysLeft === 0 ? (
                  'Target hari ini'
                ) : (
                  <>
                    <Clock className="size-3.5" />
                    {daysLeft} hari lagi
                  </>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onSetActiveTab('parties')}>
            <Users className="size-4" />
            Pihak ({caseParties.length})
            <ChevronRight className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onSetActiveTab('tahapan')}>
            <ListTodo className="size-4" />
            Tahapan ({tasks.length})
            <ChevronRight className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onSetActiveTab('dokumen')}>
            <FileText className="size-4" />
            Dokumen
            <ChevronRight className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onSetActiveTab('kalender')}>
            <Calendar className="size-4" />
            Kalender
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Kiri: Ringkasan berkas + Pihak */}
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="size-4 text-muted-foreground" />
                Ringkasan berkas
              </h2>
            </div>
            <dl className="divide-y divide-border px-4 py-3">
              <OverviewRow label="Jenis akta" value={caseData.category === 'ppat' && caseData.jenis_pekerjaan_ppat ? displayJenisPekerjaanPpat : caseData.jenis_akta} />
              <OverviewRow label="Nomor draft / akta" value={caseData.nomor_draft || '—'} />
              <OverviewRow label="Nama para pihak" value={caseData.nama_para_pihak || '—'} />
              {caseData.tanggal_mulai && (
                <OverviewRow label="Tanggal akta" value={formatDateKey(caseData.tanggal_mulai)} />
              )}
              {caseData.target_selesai && (
                <OverviewRow label="Target selesai" value={formatDateKey(caseData.target_selesai)} />
              )}
              {caseData.nilai_transaksi != null && caseData.nilai_transaksi > 0 && (
                <OverviewRow
                  label="Nilai transaksi"
                  value={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(caseData.nilai_transaksi)}
                />
              )}
              {caseData.jenis_pekerjaan_ppat && (
                <OverviewRow label="Jenis pekerjaan (PPAT)" value={displayJenisPekerjaanPpat} />
              )}
              {(caseData.luas_tanah_m2 != null || caseData.luas_bangunan_m2 != null) && (
                <OverviewRow
                  label="Luas"
                  value={[caseData.luas_tanah_m2 != null && `${caseData.luas_tanah_m2} m² tanah`, caseData.luas_bangunan_m2 != null && `${caseData.luas_bangunan_m2} m² bangunan`].filter(Boolean).join(' · ') || '—'}
                />
              )}
              <OverviewRow label="Penanggung jawab (PIC)" value={picName} />
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="size-4 text-muted-foreground" />
                Pihak dalam akta
              </h2>
              {caseParties.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => onSetActiveTab('parties')}>
                  Lihat semua
                </Button>
              )}
            </div>
            <div className="p-4">
              {caseParties.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pihak. Tambah saat entri berkas.</p>
              ) : (
                <ul className="space-y-2">
                  {caseParties.slice(0, 5).map((p) => (
                    <li key={p.case_party_id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{p.client_name || '—'}</span>
                      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {roleToLabel(p.role)}
                      </span>
                    </li>
                  ))}
                  {caseParties.length > 5 && (
                    <li>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-primary" onClick={() => onSetActiveTab('parties')}>
                        + {caseParties.length - 5} pihak lainnya →
                      </Button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Kanan: Tahapan & progress, Aksi cepat, Jadwal, Aktivitas */}
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListTodo className="size-4 text-muted-foreground" />
                Tahapan
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onOpenAddTask} className="gap-1">
                  <Plus className="size-4" />
                  Tambah
                </Button>
                <Button variant="outline" size="sm" onClick={onOpenApplyTemplate} className="gap-1">
                  <Workflow className="size-4" />
                  Template
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onSetActiveTab('tahapan')}>
                  Semua
                </Button>
              </div>
            </div>
            <div className="p-4">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada tahapan. Klik Tambah atau terapkan Template.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tabular-nums text-primary">{progressPct}%</span>
                    <span className="text-sm text-muted-foreground">
                      {doneCount} dari {tasks.length} selesai
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  {currentTask && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground">Tahapan saat ini</p>
                        <p className="truncate text-sm font-medium">{currentTask.nama_task}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onSetActiveTab('tahapan')}>
                        Kelola
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {upcomingEvents.length > 0 && (
            <section className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Calendar className="size-4 text-muted-foreground" />
                  Jadwal terdekat
                </h2>
                <Button variant="ghost" size="sm" onClick={() => onSetActiveTab('kalender')}>
                  Lihat kalender
                </Button>
              </div>
              <ul className="divide-y divide-border p-4">
                {upcomingEvents.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateKey(ev.start_at)}
                        {!ev.all_day && ` · ${formatTime(ev.start_at)}`}
                        {' · '}
                        {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <History className="size-4 text-muted-foreground" />
                Aktivitas terbaru
              </h2>
              {timeline.length > 5 && (
                <Button variant="ghost" size="sm" onClick={() => onSetActiveTab('timeline')}>
                  Lihat semua
                </Button>
              )}
            </div>
            <div className="p-4">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
              ) : (
                <ul className="space-y-2">
                  {timeline.slice(0, 5).map((ev) => (
                    <li key={ev.id} className="flex gap-3 text-sm">
                      <span className="shrink-0 text-muted-foreground tabular-nums" title={ev.at}>
                        {formatDateKey(ev.at)} {formatTime(ev.at)}
                      </span>
                      <span className="min-w-0">{ev.label}</span>
                    </li>
                  ))}
                  {timeline.length > 5 && (
                    <li>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-primary" onClick={() => onSetActiveTab('timeline')}>
                        + {timeline.length - 5} aktivitas lainnya →
                      </Button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 first:pt-0">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}
