'use client';

import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  getCaseApi,
  getTasksByCaseApi,
  getCasePartiesApi,
  getUsersApi,
  getJenisPekerjaanApi,
  createTaskApi,
  updateTaskApi,
  getWorkflowTemplatesApi,
  applyWorkflowTemplateToCaseApi,
  getTaskHistoryApi,
  getScheduleEventsApi,
  deleteScheduleEventApi,
  createProtocolEntryApi,
  getProtocolEntriesApi,
  type CaseResponse,
  type TaskResponse,
  type CasePartyItem,
  type TaskStatus,
  type WorkflowTemplateItem,
  type TaskHistoryItem,
  type ScheduleEventItem,
  type ScheduleEventType,
  type JenisPekerjaanResponse,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ArrowLeft, Plus, LayoutDashboard, ListTodo, History, FileText, User, Users, Workflow, Clock, Calendar, CalendarPlus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineItem } from '@/components/partials/activities/timeline-item';
import { ScheduleEventDialog } from '@/app/(protected)/calendar/_components/schedule-event-dialog';
import { CaseDocumentTab } from '@/app/(protected)/cases/[id]/_components/case-document-tab';
import { CaseOverviewTab } from '@/app/(protected)/cases/[id]/_components/case-overview-tab';

const TASK_STATUSES_EDITABLE: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked'];
const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Belum',
  in_progress: 'Proses',
  done: 'Selesai',
  blocked: 'Terhambat',
  waiting: 'Menunggu task sebelumnya',
};

const STATUS_LABELS: Record<string, string> = {
  drafting: 'Drafting',
  signed: 'Tanda tangan',
  registered: 'Terdaftar',
  closed: 'Arsip',
};

const EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  plotting: 'Plotting tanah',
  tanda_tangan_akad: 'Tanda tangan akad',
  batas_pajak: 'Batas pajak',
  lainnya: 'Lainnya',
};

const PARTY_ROLE_LABELS: Record<string, string> = {
  primary_contact: 'Kontak utama',
  pihak_pertama: 'Pihak pertama',
  pihak_kedua: 'Pihak kedua',
  pemberi_kuasa: 'Pemberi kuasa',
  penerima_kuasa: 'Penerima kuasa',
  saksi: 'Saksi',
  pihak_mengalihkan: 'Pihak mengalihkan',
  pihak_menerima: 'Pihak menerima',
  lainnya: 'Lainnya',
};

function roleToLabel(role: string): string {
  return PARTY_ROLE_LABELS[role] ?? role;
}

type TimelineEvent = {
  id: string;
  at: string;
  label: string;
  type: 'case_created' | 'task_created' | 'task_updated';
  actor?: string;
};

function buildTimeline(
  caseData: CaseResponse,
  tasks: TaskResponse[],
  taskHistoryByTaskId: Record<string, TaskHistoryItem[]>,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (caseData.created_at) {
    events.push({
      id: `case-${caseData.id}`,
      at: caseData.created_at,
      label: 'Berkas dibuat',
      type: 'case_created',
    });
  }
  tasks.forEach((t) => {
    const history = taskHistoryByTaskId[t.id] ?? [];
    const createdHistory = history.find((h) => h.field === 'created');
    const lastHistory = history.length > 0 ? history[history.length - 1] : undefined;

    events.push({
      id: `task-created-${t.id}`,
      at: t.created_at,
      label: `Tahapan "${t.nama_task}" ditambahkan`,
      type: 'task_created',
      actor: createdHistory?.changed_by,
    });
    if (t.updated_at && t.updated_at !== t.created_at) {
      events.push({
        id: `task-updated-${t.id}`,
        at: t.updated_at,
        label: `Tahapan "${t.nama_task}" diperbarui`,
        type: 'task_updated',
        actor: lastHistory?.changed_by,
      });
    }
  });
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return events;
}

function formatDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const caseId = typeof params.id === 'string' ? params.id : '';
  const [caseData, setCaseData] = useState<CaseResponse | null>(null);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [blockedNoteTask, setBlockedNoteTask] = useState<TaskResponse | null>(null);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => (tabParam === 'dokumen' ? 'dokumen' : 'dashboard'));
  useEffect(() => {
    if (tabParam === 'dokumen') setActiveTab('dokumen');
  }, [tabParam]);
  const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([]);
  const [scheduleEventsLoading, setScheduleEventsLoading] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDialogEdit, setScheduleDialogEdit] = useState<ScheduleEventItem | null>(null);
  const [scheduleDialogDefaultCaseId, setScheduleDialogDefaultCaseId] = useState<string | undefined>();
  const [scheduleDialogDefaultTaskId, setScheduleDialogDefaultTaskId] = useState<string | undefined>();
  const [scheduleDialogDefaultTitle, setScheduleDialogDefaultTitle] = useState<string | undefined>();
  const [taskHistoryByTaskId, setTaskHistoryByTaskId] = useState<Record<string, TaskHistoryItem[]>>({});
  const [jenisPekerjaanList, setJenisPekerjaanList] = useState<JenisPekerjaanResponse[]>([]);
  const [protocolDialogOpen, setProtocolDialogOpen] = useState(false);
  const [protocolYear, setProtocolYear] = useState('');
  const [protocolRepertorium, setProtocolRepertorium] = useState('');
  const [protocolLocation, setProtocolLocation] = useState('');
  const [protocolStatus, setProtocolStatus] = useState<'active' | 'closed'>('active');
  const [protocolNotes, setProtocolNotes] = useState('');
  const [protocolErr, setProtocolErr] = useState<string | null>(null);
  const [protocolSubmitting, setProtocolSubmitting] = useState(false);
  const [hasProtocolEntry, setHasProtocolEntry] = useState(false);
  const [caseParties, setCaseParties] = useState<CasePartyItem[]>([]);
  const [casePartiesLoading, setCasePartiesLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !caseId) return;
    setLoading(true);
    setError(null);
    try {
      const [c, t, users, jpList, partiesRes, scheduleRes] = await Promise.all([
        getCaseApi(token, caseId),
        getTasksByCaseApi(token, caseId),
        getUsersApi(token),
        getJenisPekerjaanApi(token),
        getCasePartiesApi(token, caseId).catch(() => [] as CasePartyItem[]),
        (() => {
          const now = new Date();
          const from = new Date(now.getFullYear(), now.getMonth(), 1);
          const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
          const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`;
          const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
          return getScheduleEventsApi(token, { from: fromStr, to: toStr, case_id: caseId }).catch(() => [] as ScheduleEventItem[]);
        })(),
      ]);
      setCaseData(c);
      setTasks(t);
      setCaseParties(partiesRes);
      setScheduleEvents(scheduleRes);
      if (c.status === 'registered' || c.status === 'closed') {
        try {
          const { data: protocolList } = await getProtocolEntriesApi(token, { case_id: c.id, limit: 1 });
          setHasProtocolEntry(protocolList.length > 0);
        } catch {
          setHasProtocolEntry(false);
        }
      } else {
        setHasProtocolEntry(false);
      }
      const map: Record<string, string> = {};
      users.forEach((u) => {
        map[u.id] = u.name?.trim() ? u.name : u.email;
      });
      setUserNames(map);
      setJenisPekerjaanList(jpList);
      // Muat riwayat task per task untuk mengetahui aktor perubahan (changed_by) – dipakai di Timeline.
      try {
        const historiesEntries = await Promise.all(
          t.map(async (task) => {
            try {
              const history = await getTaskHistoryApi(token, task.id);
              return [task.id, history] as const;
            } catch {
              return [task.id, [] as TaskHistoryItem[]] as const;
            }
          })
        );
        const historyMap: Record<string, TaskHistoryItem[]> = {};
        historiesEntries.forEach(([taskId, history]) => {
          historyMap[taskId] = history;
        });
        setTaskHistoryByTaskId(historyMap);
      } catch {
        setTaskHistoryByTaskId({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [token, caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadScheduleEvents = useCallback(async () => {
    if (!token || !caseId) return;
    setScheduleEventsLoading(true);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`;
      const toStr = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
      const list = await getScheduleEventsApi(token, { from: fromStr, to: toStr, case_id: caseId });
      setScheduleEvents(list);
    } catch {
      setScheduleEvents([]);
    } finally {
      setScheduleEventsLoading(false);
    }
  }, [token, caseId]);

  useEffect(() => {
    if (activeTab === 'kalender') loadScheduleEvents();
  }, [activeTab, loadScheduleEvents]);

  const loadCaseParties = useCallback(async () => {
    if (!token || !caseId) return;
    setCasePartiesLoading(true);
    try {
      const list = await getCasePartiesApi(token, caseId);
      setCaseParties(list);
    } catch {
      setCaseParties([]);
    } finally {
      setCasePartiesLoading(false);
    }
  }, [token, caseId]);

  useEffect(() => {
    if (activeTab === 'parties') loadCaseParties();
  }, [activeTab, loadCaseParties]);

  const openAddSchedule = () => {
    setScheduleDialogEdit(null);
    setScheduleDialogDefaultCaseId(caseId);
    setScheduleDialogDefaultTaskId(undefined);
    setScheduleDialogDefaultTitle(undefined);
    setScheduleDialogOpen(true);
  };

  const openScheduleForTask = (task: TaskResponse) => {
    setScheduleDialogEdit(null);
    setScheduleDialogDefaultCaseId(caseId);
    setScheduleDialogDefaultTaskId(task.id);
    setScheduleDialogDefaultTitle(task.nama_task);
    setScheduleDialogOpen(true);
  };

  const openEditSchedule = (ev: ScheduleEventItem) => {
    setScheduleDialogEdit(ev);
    setScheduleDialogDefaultCaseId(undefined);
    setScheduleDialogDefaultTaskId(undefined);
    setScheduleDialogDefaultTitle(undefined);
    setScheduleDialogOpen(true);
  };

  const handleDeleteSchedule = async (ev: ScheduleEventItem) => {
    if (!token || !confirm('Hapus jadwal ini?')) return;
    try {
      await deleteScheduleEventApi(token, ev.id);
      loadScheduleEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    }
  };

  const timeline = useMemo(() => {
    if (!caseData) return [];
    return buildTimeline(caseData, tasks, taskHistoryByTaskId);
  }, [caseData, tasks, taskHistoryByTaskId]);

  const handleTaskStatusChange = useCallback(
    async (taskId: string, status: TaskStatus) => {
      if (!token) return;
      if (status === 'blocked') {
        const task = tasks.find((t) => t.id === taskId);
        if (task) setBlockedNoteTask(task);
        return;
      }
      try {
        await updateTaskApi(token, taskId, { status });
        getTasksByCaseApi(token, caseId).then(setTasks).catch(() => {});
      } catch {
        // could toast
      }
    },
    [token, caseId, tasks]
  );

  const taskColumns = useMemo<ColumnDef<TaskResponse>[]>(
    () => [
      {
        id: 'index',
        header: '#',
        cell: ({ row }) => row.index + 1,
        size: 50,
      },
      { accessorKey: 'nama_task', header: 'Tahapan', cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
      { accessorKey: 'due_date', header: 'Jatuh tempo', cell: ({ getValue }) => getValue<string>() || '-' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const t = row.original;
          if (t.status === 'waiting') {
            return (
              <span className="text-muted-foreground text-sm" title="Akan aktif otomatis setelah task sebelumnya selesai">
                {TASK_STATUS_LABELS.waiting}
              </span>
            );
          }
          return (
            <Select
              value={t.status}
              onValueChange={(v) => handleTaskStatusChange(t.id, v as TaskStatus)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES_EDITABLE.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: 'blocked_note',
        header: 'Catatan terhambat',
        cell: ({ row }) => {
          const t = row.original;
          if (t.status === 'blocked') {
            return (
              <span className="flex items-center gap-2 max-w-[200px]">
                <span className="truncate block text-sm" title={t.blocked_note ?? ''}>
                  {t.blocked_note || '-'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 text-xs"
                  onClick={() => setBlockedNoteTask(t)}
                >
                  Ubah
                </Button>
              </span>
            );
          }
          return '-';
        },
      },
      {
        id: 'jadwal',
        header: 'Jadwal',
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openScheduleForTask(row.original)}
            className="gap-1"
            title="Jadwalkan tahapan di kalender"
          >
            <Calendar className="size-4" />
            Jadwalkan
          </Button>
        ),
      },
      {
        id: 'riwayat',
        header: 'Riwayat',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryTaskId(row.original.id)}
            className="gap-1"
          >
            <Clock className="size-4" />
            Riwayat
          </Button>
        ),
      },
    ],
    [handleTaskStatusChange]
  );

  const tasksTable = useReactTable({
    data: tasks,
    columns: taskColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (!caseId) {
    router.replace('/cases');
    return null;
  }

  const picName = caseData?.staf_penanggung_jawab_id
    ? userNames[caseData.staf_penanggung_jawab_id] ?? '-'
    : '-';

  // Tampilkan nama jenis pekerjaan (bukan id) untuk PPAT; fallback ke jenis_akta / id jika belum ter-resolve
  const displayJenisTitle = caseData
    ? caseData.category === 'ppat' && caseData.jenis_pekerjaan_ppat
      ? (jenisPekerjaanList.find((j) => j.id === caseData.jenis_pekerjaan_ppat)?.name ?? caseData.jenis_pekerjaan_ppat)
      : caseData.jenis_akta
    : '';
  const displayJenisPekerjaanPpat = caseData?.jenis_pekerjaan_ppat
    ? (jenisPekerjaanList.find((j) => j.id === caseData.jenis_pekerjaan_ppat)?.name ?? caseData.jenis_pekerjaan_ppat)
    : '';

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title={caseData ? caseData.nomor_draft || displayJenisTitle : 'Berkas Akta'}
          description={caseData?.nama_para_pihak}
        />
        <ToolbarActions>
          <Button variant="outline" asChild>
            <Link href="/cases">
              <ArrowLeft className="me-2 size-4" />
              Daftar
            </Link>
          </Button>
          {caseData && (caseData.status === 'registered' || caseData.status === 'closed') && !hasProtocolEntry && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProtocolErr(null);
                setProtocolSubmitting(false);
                setProtocolYear(String(new Date().getFullYear()));
                setProtocolRepertorium('');
                setProtocolLocation('');
                setProtocolStatus('active');
                setProtocolNotes('');
                setProtocolDialogOpen(true);
              }}
            >
              <FileText className="me-2 size-4" />
              Tambah ke Digital Protocol
            </Button>
          )}
        </ToolbarActions>
      </Toolbar>

      <div className="container">
        {error && <p className="mb-4 text-destructive">{error}</p>}
        {loading ? (
          <p className="text-muted-foreground">Memuat...</p>
        ) : !caseData ? (
          <p className="text-muted-foreground">Berkas tidak ditemukan.</p>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList variant="line" className="mb-4 border-b border-border bg-transparent p-0">
                <TabsTrigger value="dashboard" className="gap-2">
                  <LayoutDashboard className="size-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="parties" className="gap-2">
                  <Users className="size-4" />
                  Parties
                </TabsTrigger>
                <TabsTrigger value="tahapan" className="gap-2">
                  <ListTodo className="size-4" />
                  Tahapan
                </TabsTrigger>
                <TabsTrigger value="dokumen" className="gap-2">
                  <FileText className="size-4" />
                  Dokumen
                </TabsTrigger>                
                <TabsTrigger value="kalender" className="gap-2">
                  <Calendar className="size-4" />
                  Kalender
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <History className="size-4" />
                  Timeline
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="mt-0">
                <CaseOverviewTab
                  caseData={caseData}
                  tasks={tasks}
                  caseParties={caseParties}
                  scheduleEvents={scheduleEvents}
                  timeline={timeline}
                  userNames={userNames}
                  displayJenisTitle={displayJenisTitle}
                  displayJenisPekerjaanPpat={displayJenisPekerjaanPpat}
                  picName={picName}
                  STATUS_LABELS={STATUS_LABELS}
                  formatDateKey={formatDateKey}
                  formatTime={formatTime}
                  roleToLabel={roleToLabel}
                  onSetActiveTab={setActiveTab}
                  onOpenAddTask={() => setAddTaskOpen(true)}
                  onOpenApplyTemplate={() => setApplyTemplateOpen(true)}
                />
              </TabsContent>

              <TabsContent value="parties" className="mt-0">
                <section className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="border-b border-border px-4 py-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="size-4 text-muted-foreground" />
                      Pihak dalam akta
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Daftar pihak (klien) yang terlibat dalam berkas ini beserta perannya.
                    </p>
                  </div>
                  <div className="p-4">
                    {casePartiesLoading ? (
                      <p className="text-sm text-muted-foreground">Memuat...</p>
                    ) : caseParties.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada pihak. Pihak ditambahkan saat entri berkas.</p>
                    ) : (
                      <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
                        <table className="kt-table w-full align-middle">
                          <thead>
                            <tr>
                              <th scope="col" className="w-12">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">#</span>
                                </span>
                              </th>
                              <th scope="col" className="min-w-[200px]">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">Nama klien</span>
                                </span>
                              </th>
                              <th scope="col" className="min-w-[160px]">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">Peran</span>
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {caseParties.map((p, idx) => (
                              <tr key={p.case_party_id}>
                                <td className="align-middle text-muted-foreground">{idx + 1}</td>
                                <td className="align-middle font-medium">{p.client_name || '—'}</td>
                                <td className="align-middle">
                                  <span className="kt-badge kt-badge-info">
                                    {roleToLabel(p.role)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="tahapan" className="mt-0">
                <div className="grid w-full space-y-5">
                  <div className="kt-card">
                    <div className="kt-card-header flex flex-row items-center justify-between gap-4 py-4 min-h-14 border-b border-border">
                      <h3 className="text-lg font-semibold">Tahapan proses</h3>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => setAddTaskOpen(true)} size="sm">
                          <Plus className="me-2 size-4" />
                          Tambah Tahapan
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setApplyTemplateOpen(true)}
                        >
                          <Workflow className="me-1.5 size-4" />
                          Terapkan Template
                        </Button>
                      </div>
                    </div>
                    <div className="kt-card-table">
                      <div className="kt-table-wrapper kt-scrollable overflow-x-auto">
                        <table className="kt-table w-full align-middle">
                          <thead>
                            <tr>
                              <th scope="col" className="w-12">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">#</span>
                                </span>
                              </th>
                              <th scope="col" className="min-w-[160px]">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">Tahapan</span>
                                  <span className="kt-table-col-sort" />
                                </span>
                              </th>
                              <th scope="col" className="w-28">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">Jatuh tempo</span>
                                  <span className="kt-table-col-sort" />
                                </span>
                              </th>
                              <th scope="col" className="w-40">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">Status</span>
                                  <span className="kt-table-col-sort" />
                                </span>
                              </th>
                              <th scope="col" className="min-w-[180px]">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">Catatan terhambat</span>
                                </span>
                              </th>
                              <th scope="col" className="w-28">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">Jadwal</span>
                                </span>
                              </th>
                              <th scope="col" className="w-24">
                                <span className="kt-table-col">
                                  <span className="kt-table-col-label">Riwayat</span>
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {tasksTable.getRowModel().rows.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="text-center text-muted-foreground py-8">
                                  Belum ada tahapan. Klik &quot;Tambah Tahapan&quot;.
                                </td>
                              </tr>
                            ) : (
                              tasksTable.getRowModel().rows.map((row) => (
                                <tr key={row.id}>
                                  {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="align-middle">
                                      {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      {tasks.length > 0 && (
                        <div className="kt-datatable-toolbar">
                          <div className="kt-datatable-length flex flex-wrap items-center gap-2">
                            Tampilkan
                            <select
                              className="kt-select kt-select-sm w-16"
                              value={tasksTable.getState().pagination.pageSize}
                              onChange={(e) =>
                                tasksTable.setPageSize(Number(e.target.value))
                              }
                            >
                              {[5, 10, 20, 50].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                            per halaman
                          </div>
                          <div className="kt-datatable-info flex flex-wrap items-center gap-2">
                            <span>
                              {(() => {
                                const { pageIndex, pageSize } = tasksTable.getState().pagination;
                                const total = tasks.length;
                                const start = total === 0 ? 0 : pageIndex * pageSize + 1;
                                const end = Math.min((pageIndex + 1) * pageSize, total);
                                return total === 0 ? '0 data' : `${start}-${end} dari ${total}`;
                              })()}
                            </span>
                            {tasksTable.getPageCount() > 1 && (() => {
                              const pageCount = tasksTable.getPageCount();
                              const pageIndex = tasksTable.getState().pagination.pageIndex;
                              const limit = 5;
                              const groupStart = Math.floor(pageIndex / limit) * limit;
                              const groupEnd = Math.min(groupStart + limit, pageCount);
                              return (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => tasksTable.previousPage()}
                                    disabled={!tasksTable.getCanPreviousPage()}
                                  >
                                    <ChevronLeft className="size-4" />
                                  </Button>
                                  {groupStart > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="size-7 min-w-7 p-0 text-sm"
                                      onClick={() => tasksTable.setPageIndex(groupStart - 1)}
                                    >
                                      ...
                                    </Button>
                                  )}
                                  {Array.from({ length: groupEnd - groupStart }, (_, i) => groupStart + i).map((i) => (
                                    <Button
                                      key={i}
                                      variant="ghost"
                                      size="sm"
                                      className={cn(
                                        'size-7 min-w-7 p-0 text-sm',
                                        pageIndex === i && 'bg-accent text-accent-foreground'
                                      )}
                                      onClick={() => tasksTable.setPageIndex(i)}
                                    >
                                      {i + 1}
                                    </Button>
                                  ))}
                                  {groupEnd < pageCount && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="size-7 min-w-7 p-0 text-sm"
                                      onClick={() => tasksTable.setPageIndex(groupEnd)}
                                    >
                                      ...
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    onClick={() => tasksTable.nextPage()}
                                    disabled={!tasksTable.getCanNextPage()}
                                  >
                                    <ChevronRight className="size-4" />
                                  </Button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="kalender" className="mt-0">
                <section className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Calendar className="size-4 text-muted-foreground" />
                      Jadwal terkait berkas ini
                    </h3>
                    <Button size="sm" onClick={openAddSchedule}>
                      <CalendarPlus className="me-2 size-4" />
                      Tambah jadwal
                    </Button>
                  </div>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Jadwal yang dikaitkan ke berkas ini (plotting, TTA, batas pajak, dll). Bisa juga menjadwalkan tahapan dari tab Tahapan.
                  </p>
                  {scheduleEventsLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat jadwal...</p>
                  ) : scheduleEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada jadwal. Klik &quot;Tambah jadwal&quot; atau dari tab Tahapan pilih &quot;Jadwalkan&quot; pada tahapan.</p>
                  ) : (
                    <ul className="space-y-2">
                      {scheduleEvents
                        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
                        .map((ev) => (
                          <li
                            key={ev.id}
                            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{ev.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateKey(ev.start_at)}
                                {!ev.all_day && ` · ${formatTime(ev.start_at)}${ev.end_at ? ` – ${formatTime(ev.end_at)}` : ''}`}
                                {' · '}
                                {EVENT_TYPE_LABELS[ev.event_type]}
                                {ev.task_id && ' · Terkait tahapan'}
                                {ev.location && ` · ${ev.location}`}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditSchedule(ev)}>
                                Ubah
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteSchedule(ev)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="timeline" className="mt-0">
                <section className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                    <History className="size-4 text-muted-foreground" />
                    Timeline
                  </h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Log aktivitas untuk berkas ini (perubahan tahapan, jadwal, dll).
                  </p>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
                  ) : (
                    <div className="relative">
                      {/* Garis vertikal kontinu agar tidak terputus oleh space-y-4 atau heading tanggal */}
                      <div
                        className="absolute top-9 bottom-0 w-px bg-border"
                        style={{ left: '18px' }}
                        aria-hidden
                      />
                      <div className="space-y-4 relative">
                        {(() => {
                          const nodes: JSX.Element[] = [];
                          let lastDateKey: string | null = null;
                          const sorted = [...timeline].sort(
                            (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
                          );
                          sorted.forEach((ev, index) => {
                            const dateKey = formatDateKey(ev.at);
                            const showDate = dateKey !== lastDateKey;
                            lastDateKey = dateKey;

                            if (showDate) {
                              nodes.push(
                                <h4
                                  key={`date-${dateKey}`}
                                  className="text-xs font-medium text-muted-foreground"
                                >
                                  {dateKey}
                                </h4>,
                              );
                            }

                            const isLast = index === sorted.length - 1;
                            nodes.push(
                              <TimelineItem
                                key={ev.id}
                                icon={ev.type === 'case_created' ? FileText : ListTodo}
                                line={false}
                                removeSpace={isLast}
                              >
                              <p className="text-sm">
                                {ev.label}
                                {ev.actor && (
                                  <span className="text-xs text-muted-foreground">
                                    {' '}
                                    — {userNames[ev.actor] ?? ev.actor}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatTime(ev.at)}
                              </p>
                            </TimelineItem>,
                          );
                        });
                        return nodes;
                      })()}
                      </div>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="dokumen" className="mt-0">
                <CaseDocumentTab
                  caseId={caseId}
                  token={token}
                  picName={caseData?.staf_penanggung_jawab_id ? (userNames[caseData.staf_penanggung_jawab_id] ?? '-') : '-'}
                  userRole={user?.role_name}
                  currentUserName={user?.name ?? user?.email}
                  primaryClientName={
                    caseParties.find((p) => p.role === 'primary_contact')?.client_name ??
                    caseParties[0]?.client_name ??
                    ''
                  }
                />
              </TabsContent>
            </Tabs>
            <Dialog open={protocolDialogOpen} onOpenChange={setProtocolDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah ke Digital Protocol</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!token || !caseData) return;
                    const yearValue =
                      protocolYear.trim() !== ''
                        ? Number(protocolYear.trim())
                        : new Date().getFullYear();
                    if (!yearValue || isNaN(yearValue)) {
                      setProtocolErr('Tahun tidak valid.');
                      return;
                    }
                    if (!protocolRepertorium.trim() || !protocolLocation.trim()) {
                      setProtocolErr('No repertorium dan lokasi wajib diisi.');
                      return;
                    }
                    try {
                      setProtocolSubmitting(true);
                      setProtocolErr(null);
                      await createProtocolEntryApi(token, {
                        case_id: caseData.id,
                        year: yearValue,
                        repertorium_number: protocolRepertorium.trim(),
                        jenis: caseData.jenis_akta || 'Akta',
                        physical_location: protocolLocation.trim(),
                        status: protocolStatus,
                        notes: protocolNotes.trim() || undefined,
                      });
                      setProtocolDialogOpen(false);
                      setHasProtocolEntry(true);
                    } catch (err) {
                      setProtocolErr(
                        err instanceof Error
                          ? err.message
                          : 'Gagal membuat entri Digital Protocol',
                      );
                    } finally {
                      setProtocolSubmitting(false);
                    }
                  }}
                >
                  <DialogBody className="space-y-4">
                    {protocolErr && (
                      <p className="text-sm text-destructive">{protocolErr}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="proto_year">Tahun</Label>
                        <Input
                          id="proto_year"
                          value={protocolYear}
                          onChange={(e) => setProtocolYear(e.target.value)}
                          placeholder={String(new Date().getFullYear())}
                          inputMode="numeric"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="proto_rep">No Repertorium</Label>
                        <Input
                          id="proto_rep"
                          value={protocolRepertorium}
                          onChange={(e) => setProtocolRepertorium(e.target.value)}
                          placeholder="mis. 12/2026"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Jenis</Label>
                      <Input
                        value={caseData.jenis_akta}
                        readOnly
                        className="bg-muted/60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="proto_loc">Lokasi fisik</Label>
                      <Input
                        id="proto_loc"
                        value={protocolLocation}
                        onChange={(e) => setProtocolLocation(e.target.value)}
                        placeholder="mis. Rak A1, Box B2"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select
                        value={protocolStatus}
                        onValueChange={(v) => setProtocolStatus(v as 'active' | 'closed')}
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
                      <Label htmlFor="proto_notes">Catatan (opsional)</Label>
                      <Input
                        id="proto_notes"
                        value={protocolNotes}
                        onChange={(e) => setProtocolNotes(e.target.value)}
                        placeholder="Catatan tambahan"
                      />
                    </div>
                  </DialogBody>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setProtocolDialogOpen(false)}
                      disabled={protocolSubmitting}
                    >
                      Batal
                    </Button>
                    <Button type="submit" disabled={protocolSubmitting}>
                      Simpan
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        caseId={caseId}
        taskCount={tasks.length}
        token={token}
        onSuccess={() => {
          setAddTaskOpen(false);
          load();
        }}
      />

      <ApplyTemplateDialog
        open={applyTemplateOpen}
        onOpenChange={setApplyTemplateOpen}
        caseId={caseId}
        category={caseData?.category ?? 'notaris'}
        token={token}
        onSuccess={() => {
          setApplyTemplateOpen(false);
          load();
        }}
      />

      {historyTaskId && (
        <TaskHistoryDialog
          open={!!historyTaskId}
          onOpenChange={(open) => !open && setHistoryTaskId(null)}
          taskId={historyTaskId}
          taskName={tasks.find((t) => t.id === historyTaskId)?.nama_task ?? 'Tahapan'}
          token={token}
          userNames={userNames}
        />
      )}

      {blockedNoteTask && (
        <BlockedNoteDialog
          open={!!blockedNoteTask}
          onOpenChange={(open) => !open && setBlockedNoteTask(null)}
          task={blockedNoteTask}
          token={token}
          onSuccess={() => {
            setBlockedNoteTask(null);
            load();
          }}
          onCancel={() => {
            setBlockedNoteTask(null);
            load();
          }}
        />
      )}

      <ScheduleEventDialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          setScheduleDialogOpen(open);
          if (!open) setScheduleDialogEdit(null);
        }}
        token={token}
        editEvent={scheduleDialogEdit}
        defaultCaseId={scheduleDialogDefaultCaseId}
        defaultTaskId={scheduleDialogDefaultTaskId}
        defaultTitle={scheduleDialogDefaultTitle}
        onSuccess={() => {
          loadScheduleEvents();
        }}
      />
    </>
  );
}

function AddTaskDialog({
  open,
  onOpenChange,
  caseId,
  taskCount,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  taskCount: number;
  token: string | null;
  onSuccess: () => void;
}) {
  const [namaTask, setNamaTask] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sortOrderStr, setSortOrderStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaTask.trim()) {
      setErr('Nama tahapan wajib.');
      return;
    }
    const sortOrderNum = sortOrderStr.trim() ? parseInt(sortOrderStr, 10) : undefined;
    if (sortOrderStr.trim() && (isNaN(sortOrderNum!) || sortOrderNum! < 1)) {
      setErr('Urutan harus angka positif (1 = pertama).');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await createTaskApi(token, {
        case_id: caseId,
        nama_task: namaTask.trim(),
        due_date: dueDate.trim() || undefined,
        sort_order: sortOrderNum != null ? sortOrderNum - 1 : undefined,
      });
      setNamaTask('');
      setDueDate('');
      setSortOrderStr('');
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menambah tahapan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Tahapan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="space-y-2">
              <Label htmlFor="nama_task">Nama tahapan *</Label>
              <Input
                id="nama_task"
                value={namaTask}
                onChange={(e) => setNamaTask(e.target.value)}
                placeholder="Contoh: Terima dokumen, Draft akta"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Urutan (opsional)</Label>
              <Input
                id="sort_order"
                type="number"
                min={1}
                max={taskCount + 1}
                value={sortOrderStr}
                onChange={(e) => setSortOrderStr(e.target.value)}
                placeholder={`1 = pertama, kosong = tambah di akhir (saat ini ${taskCount} tahapan)`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Jatuh tempo</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
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

function BlockedNoteDialog({
  open,
  onOpenChange,
  task,
  token,
  onSuccess,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskResponse;
  token: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState(task.blocked_note ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNote(task.blocked_note ?? '');
      setErr(null);
    }
  }, [open, task.id, task.blocked_note]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setErr(null);
    try {
      await updateTaskApi(token, task.id, { status: 'blocked', blocked_note: note.trim() || undefined });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan catatan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catatan alasan terhambat</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <p className="text-sm text-muted-foreground">
              Tahapan: <strong>{task.nama_task}</strong>. Jelaskan mengapa tahapan ini terhambat (opsional).
            </p>
            <div className="space-y-2">
              <Label htmlFor="blocked_note">Catatan</Label>
              <textarea
                id="blocked_note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contoh: Menunggu dokumen dari klien, Sertifikat belum terbit"
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
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

function ApplyTemplateDialog({
  open,
  onOpenChange,
  caseId,
  category,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  category: 'notaris' | 'ppat';
  token: string | null;
  onSuccess: () => void;
}) {
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && token) {
      getWorkflowTemplatesApi(token, { category }).then(setTemplates).catch(() => setTemplates([]));
      setSelectedId('');
      setErr(null);
    }
  }, [open, token, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId.trim()) {
      setErr('Pilih template workflow.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await applyWorkflowTemplateToCaseApi(token, caseId, { workflow_template_id: selectedId });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menerapkan template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Terapkan Template Workflow</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && <p className="text-sm text-destructive">{err}</p>}
            <p className="text-sm text-muted-foreground">
              Task dari template akan ditambahkan di akhir daftar tahapan (append). Tidak menghapus tahapan yang sudah ada.
            </p>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedId || '_none'} onValueChange={(v) => setSelectedId(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">-- Pilih template --</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.jenis_pekerjaan ? `(${t.jenis_pekerjaan})` : ''} — {t.steps?.length ?? 0} step
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting || !selectedId.trim()}>
              {submitting ? 'Menerapkan...' : 'Terapkan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskHistoryDialog({
  open,
  onOpenChange,
  taskId,
  taskName,
  token,
  userNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskName: string;
  token: string | null;
  userNames: Record<string, string>;
}) {
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && token && taskId) {
      setLoading(true);
      getTaskHistoryApi(token, taskId)
        .then(setHistory)
        .catch(() => setHistory([]))
        .finally(() => setLoading(false));
    }
  }, [open, token, taskId]);

  const fieldLabel: Record<string, string> = {
    created: 'Dibuat',
    status: 'Status',
    assigned_to: 'Assignee',
    due_date: 'Jatuh tempo',
    nama_task: 'Nama task',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Riwayat: {taskName}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex gap-2 border-b border-border pb-2 last:border-0">
                  <span className="shrink-0 text-muted-foreground">
                    {formatTime(h.created_at)} — {fieldLabel[h.field] ?? h.field}
                    {h.old_value != null && h.old_value !== '' ? `: ${h.old_value} → ${h.new_value ?? ''}` : h.new_value ? `: ${h.new_value}` : ''}
                  </span>
                  {h.changed_by && (
                    <span className="text-muted-foreground">oleh {userNames[h.changed_by] ?? h.changed_by}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
