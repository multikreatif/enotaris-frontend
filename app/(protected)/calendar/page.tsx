'use client';

import React, { useRef, useCallback, useState } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/auth-provider';
import {
  getScheduleEventsApi,
  getCaseApi,
  type ScheduleEventItem,
  type ScheduleEventType,
} from '@/lib/api';
import { ScheduleEventDialog } from './_components/schedule-event-dialog';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import idLocale from '@fullcalendar/core/locales/id';
import { Plus } from 'lucide-react';
import type { EventClickArg, EventInput } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';

const EVENT_TYPE_LABELS: Record<ScheduleEventType, string> = {
  plotting: 'Plotting tanah',
  tanda_tangan_akad: 'Tanda tangan akad',
  batas_pajak: 'Batas pajak',
  lainnya: 'Lainnya',
};

/** Warna per tipe acara — dipakai di kalender dan legenda (hex agar selalu tampil) */
const EVENT_TYPE_COLORS: Record<ScheduleEventType, { bg: string; border: string }> = {
  plotting: { bg: '#2563eb', border: '#1d4ed8' },
  tanda_tangan_akad: { bg: '#16a34a', border: '#15803d' },
  batas_pajak: { bg: '#d97706', border: '#b45309' },
  lainnya: { bg: '#64748b', border: '#475569' },
};

function toYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function CalendarPage() {
  const { token } = useAuth();
  const calendarRef = useRef<FullCalendar>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<ScheduleEventItem | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  const refetchEvents = useCallback(() => {
    const api = calendarRef.current?.getApi();
    if (api) api.refetchEvents();
  }, []);

  const handleEvents = useCallback(
    (
      fetchInfo: { start: Date; end: Date },
      successCallback: (events: EventInput[]) => void,
      failureCallback: (error: Error) => void,
    ) => {
      if (!token) {
        successCallback([]);
        return;
      }
      const from = toYYYYMMDD(fetchInfo.start);
      const to = toYYYYMMDD(fetchInfo.end);
      getScheduleEventsApi(token, { from, to })
        .then(async (list) => {
          const caseIds = Array.from(new Set(list.map((ev) => ev.case_id).filter(Boolean) as string[]));
          const caseCache: Record<string, { nomor_draft: string; nama_para_pihak: string }> = {};
          await Promise.all(
            caseIds.map((id) =>
              getCaseApi(token, id)
                .then((c) => {
                  caseCache[id] = {
                    nomor_draft: c.nomor_draft || c.jenis_akta || id,
                    nama_para_pihak: c.nama_para_pihak || '',
                  };
                })
                .catch(() => {}),
            ),
          );
          const events: EventInput[] = list.map((ev) => {
            const clientLabel = ev.case_id
              ? (() => {
                  const c = caseCache[ev.case_id!];
                  if (!c) return null;
                  return c.nama_para_pihak ? `${c.nomor_draft} — ${c.nama_para_pihak}` : c.nomor_draft;
                })()
              : null;
            const eventType = (ev.event_type || 'lainnya') as ScheduleEventType;
            const colors = EVENT_TYPE_COLORS[eventType] ?? EVENT_TYPE_COLORS.lainnya;
            return {
              id: ev.id,
              title: ev.title,
              start: ev.start_at,
              end: ev.end_at ?? undefined,
              allDay: ev.all_day,
              backgroundColor: colors.bg,
              borderColor: colors.border,
              extendedProps: { raw: ev, clientLabel },
            };
          });
          successCallback(events);
        })
        .catch((err) => {
          successCallback([]);
          failureCallback(err instanceof Error ? err : new Error(String(err)));
        });
    },
    [token],
  );

  const handleEventClick = useCallback((info: EventClickArg) => {
    info.jsEvent.preventDefault();
    const raw = (info.event.extendedProps as { raw?: ScheduleEventItem }).raw;
    if (raw) {
      setEditEvent(raw);
      setDefaultDate(undefined);
      setDialogOpen(true);
    }
  }, []);

  const handleDateSelect = useCallback((info: DateClickArg) => {
    setEditEvent(null);
    setDefaultDate(info.dateStr.slice(0, 10));
    setDialogOpen(true);
  }, []);

  const handleAddClick = useCallback(() => {
    setEditEvent(null);
    setDefaultDate(undefined);
    setDialogOpen(true);
  }, []);

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Kalender" />
        <ToolbarActions>
          <Button onClick={handleAddClick}>
            <Plus className="size-4 mr-2" />
            Tambah jadwal
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="container">
        <div className="rounded-lg border border-border bg-card overflow-hidden p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={idLocale}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            buttonText={{
              today: 'Hari ini',
              month: 'Bulan',
              week: 'Minggu',
              day: 'Hari',
              list: 'Daftar',
            }}
            height="auto"
            events={handleEvents}
            eventClick={handleEventClick}
            dateClick={handleDateSelect}
            editable={false}
            selectable={true}
            selectMirror={false}
            dayMaxEvents={3}
            moreLinkText={(n) => `+${n} lagi`}
            eventContent={(arg) => {
              const clientLabel = (arg.event.extendedProps as { clientLabel?: string | null }).clientLabel;
              const title = escapeHtml(arg.event.title);
              const sub = clientLabel
                ? `<div style="font-size:0.75rem;line-height:1.1;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(clientLabel)}</div>`
                : '';
              return {
                html:
                  `<div style="display:flex;flex-direction:column;gap:2px;min-width:0">` +
                  `<div style="font-weight:600;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</div>` +
                  sub +
                  `</div>`,
              };
            }}
          />
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <h3 className="font-medium mb-2">Legenda tipe acara</h3>
          <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {(Object.entries(EVENT_TYPE_LABELS) as [ScheduleEventType, string][]).map(([value, label]) => {
              const colors = EVENT_TYPE_COLORS[value];
              return (
                <li key={value} className="flex items-center gap-2">
                  <span
                    className="size-4 shrink-0 rounded border"
                    style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                    aria-hidden
                  />
                  <span className="font-medium text-foreground">{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <ScheduleEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        token={token}
        editEvent={editEvent}
        defaultDate={defaultDate}
        onSuccess={refetchEvents}
      />
    </>
  );
}
