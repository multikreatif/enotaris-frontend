'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { TaskListItem } from '@/lib/api';

export interface TaskListWidgetProps {
  title: string;
  tasks: TaskListItem[];
  /** Base path untuk link ke case (e.g. /cases) */
  caseDetailPath?: (caseId: string) => string;
  className?: string;
}

function formatDueTime(dueDate: string | null | undefined): string {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hari ini ${timeStr}`;
  return `${dateStr} ${timeStr}`;
}

function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'done') return false;
  return new Date(dueDate) < new Date();
}

export function TaskListWidget({
  title,
  tasks,
  caseDetailPath = (id) => `/cases/${id}`,
  className,
}: TaskListWidgetProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada task dengan jadwal hari ini.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.slice(0, 8).map((task) => {
              const overdue = isOverdue(task.due_date, task.status);
              return (
                <li key={task.id}>
                  <Link
                    href={caseDetailPath(task.case_id)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors hover:bg-muted/50 hover:border-border',
                      overdue && 'border-destructive/30 bg-destructive/5',
                    )}
                  >
                    {overdue ? (
                      <AlertCircle className="size-4 shrink-0 text-destructive" />
                    ) : task.status === 'done' ? (
                      <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                    ) : (
                      <Clock className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{task.nama_task}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {task.case_nomor_draft || task.case_nama_para_pihak || task.case_id}
                        {task.assigned_to_name ? ` · ${task.assigned_to_name}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-xs',
                        overdue ? 'text-destructive font-medium' : 'text-muted-foreground',
                      )}
                    >
                      {formatDueTime(task.due_date)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
