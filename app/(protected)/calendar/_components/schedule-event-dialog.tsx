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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  createScheduleEventApi,
  updateScheduleEventApi,
  getCasesApi,
  getTasksByCaseApi,
  type ScheduleEventItem,
  type ScheduleEventType,
  type CreateScheduleEventBody,
  type CaseResponse,
  type TaskResponse,
} from '@/lib/api';

const EVENT_TYPES: { value: ScheduleEventType; label: string }[] = [
  { value: 'plotting', label: 'Plotting tanah' },
  { value: 'tanda_tangan_akad', label: 'Tanda tangan akad' },
  { value: 'batas_pajak', label: 'Batas akhir pembayaran pajak' },
  { value: 'lainnya', label: 'Lainnya' },
];

const REMINDER_OPTIONS = [
  { value: '', label: 'Tidak ada' },
  { value: '15', label: '15 menit sebelum' },
  { value: '60', label: '1 jam sebelum' },
  { value: '1440', label: '1 hari sebelum' },
  { value: '2880', label: '2 hari sebelum' },
];

function toLocalDateOnly(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalTime(iso: string): string {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/** Build RFC3339 string from date (YYYY-MM-DD) and time (HH:mm) in local timezone so backend stores correct UTC. */
function toLocalISOWithOffset(dateStr: string, timeStr: string): string {
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  const offsetPart = `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${dateStr}T${timeStr}:00${offsetPart}`;
}

export function ScheduleEventDialog({
  open,
  onOpenChange,
  token,
  editEvent,
  defaultDate,
  defaultCaseId,
  defaultTaskId,
  defaultTitle,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  editEvent: ScheduleEventItem | null;
  defaultDate?: string;
  /** Saat buat jadwal dari detail berkas: otomatis kaitkan ke berkas ini */
  defaultCaseId?: string;
  /** Saat buat jadwal dari tahapan: otomatis kaitkan ke task ini */
  defaultTaskId?: string;
  /** Judul awal (mis. nama tahapan saat "Jadwalkan" dari task) */
  defaultTitle?: string;
  onSuccess: () => void;
}) {
  const isEdit = !!editEvent;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState<ScheduleEventType>('lainnya');
  const [startDate, setStartDate] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [reminderMinutes, setReminderMinutes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [linkCaseId, setLinkCaseId] = useState<string>('');
  const [linkTaskId, setLinkTaskId] = useState<string>('');
  const [cases, setCases] = useState<CaseResponse[]>([]);
  const [tasksForCase, setTasksForCase] = useState<TaskResponse[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const showLinkToCase = !isEdit && !defaultCaseId;
  const effectiveCaseId = defaultCaseId || linkCaseId || undefined;
  const effectiveTaskId = defaultTaskId || linkTaskId || undefined;

  useEffect(() => {
    if (open && showLinkToCase && token) {
      getCasesApi(token, { limit: 200 })
        .then((r) => setCases(r.data))
        .catch(() => setCases([]));
    }
  }, [open, showLinkToCase, token]);

  const loadTasksForCase = useCallback(async (caseId: string) => {
    if (!token) return;
    setLoadingTasks(true);
    try {
      const list = await getTasksByCaseApi(token, caseId);
      setTasksForCase(list);
    } catch {
      setTasksForCase([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [token]);

  useEffect(() => {
    if (linkCaseId) loadTasksForCase(linkCaseId);
    else {
      setTasksForCase([]);
      setLinkTaskId('');
    }
  }, [linkCaseId, loadTasksForCase]);

  useEffect(() => {
    if (!open) return;
    setLinkCaseId('');
    setLinkTaskId('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editEvent) {
      setTitle(editEvent.title);
      setDescription(editEvent.description ?? '');
      setLocation(editEvent.location ?? '');
      setEventType(editEvent.event_type);
      setStartDate(toLocalDateOnly(editEvent.start_at));
      setAllDay(editEvent.all_day);
      setStartTime(editEvent.all_day ? '09:00' : toLocalTime(editEvent.start_at));
      setEndTime(editEvent.end_at ? toLocalTime(editEvent.end_at) : '10:00');
      setReminderMinutes(
        editEvent.reminder_minutes_before != null ? String(editEvent.reminder_minutes_before) : '',
      );
    } else {
      setTitle(defaultTitle ?? '');
      setDescription('');
      setLocation('');
      setEventType('lainnya');
      setStartDate(defaultDate || new Date().toISOString().slice(0, 10));
      setAllDay(true);
      setStartTime('09:00');
      setEndTime('10:00');
      setReminderMinutes('');
    }
    setErr(null);
  }, [open, editEvent, defaultDate, defaultTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErr('Judul wajib diisi.');
      return;
    }
    if (!startDate) {
      setErr('Tanggal wajib diisi.');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      // Kirim waktu dengan timezone lokal (RFC3339) agar backend menyimpan UTC dengan benar
      const startAt = allDay ? startDate : toLocalISOWithOffset(startDate, startTime);
      const endAt = allDay ? undefined : toLocalISOWithOffset(startDate, endTime);
      const reminder = reminderMinutes === '' ? undefined : parseInt(reminderMinutes, 10);

      if (isEdit && editEvent) {
        await updateScheduleEventApi(token, editEvent.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || null,
          event_type: eventType,
          start_at: startAt,
          end_at: endAt ?? null,
          all_day: allDay,
          reminder_minutes_before: reminder ?? null,
        });
      } else {
        const body: CreateScheduleEventBody = {
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          event_type: eventType,
          start_at: startAt,
          end_at: endAt,
          all_day: allDay,
          reminder_minutes_before: reminder ?? undefined,
          case_id: effectiveCaseId,
          task_id: effectiveTaskId,
        };
        await createScheduleEventApi(token, body);
      }
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal menyimpan jadwal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Ubah jadwal' : 'Tambah jadwal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            {err && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {err}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ev_title">Judul *</Label>
              <Input
                id="ev_title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Plotting tanah Lokasi X"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev_desc">Deskripsi</Label>
              <Input
                id="ev_desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opsional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev_location">Lokasi</Label>
              <Input
                id="ev_location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Kantor notaris, Lokasi tanah, Alamat TTB"
              />
            </div>

            {showLinkToCase && (
              <>
                <div className="space-y-2">
                  <Label>Terkait berkas (opsional)</Label>
                  <Select value={linkCaseId || '_none'} onValueChange={(v) => setLinkCaseId(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih berkas untuk mengaitkan jadwal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Tidak dikaitkan</SelectItem>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nomor_draft || c.jenis_akta || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {effectiveCaseId && (
                  <div className="space-y-2">
                    <Label>Terkait tahapan (opsional)</Label>
                    <Select
                      value={linkTaskId || '_none'}
                      onValueChange={(v) => setLinkTaskId(v === '_none' ? '' : v)}
                      disabled={loadingTasks}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingTasks ? 'Memuat tahapan...' : 'Pilih tahapan'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Tidak dikaitkan</SelectItem>
                        {tasksForCase.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.nama_task}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Tipe acara</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as ScheduleEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev_date">Tanggal *</Label>
              <Input
                id="ev_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ev_allday"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="ev_allday" className="font-normal cursor-pointer">
                Sepanjang hari
              </Label>
            </div>

            {!allDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ev_start">Jam mulai</Label>
                  <Input
                    id="ev_start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ev_end">Jam selesai</Label>
                  <Input
                    id="ev_end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Pengingat</Label>
              <Select value={reminderMinutes || '_none'} onValueChange={(v) => setReminderMinutes(v === '_none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tidak ada" />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((r) => (
                    <SelectItem key={r.value || '_none'} value={r.value || '_none'}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : isEdit ? 'Simpan perubahan' : 'Simpan jadwal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
