'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/layout-10/components/toolbar';
import { useAuth } from '@/providers/auth-provider';
import { getDashboardStatsApi, getTasksListApi } from '@/lib/api';
import type { DashboardStats } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { ChartWidget } from '@/components/dashboard/chart-widget';
import { TaskListWidget } from '@/components/dashboard/task-list-widget';
import { FileText, AlertCircle, PenLine, Archive, Plus } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  drafting: 'Drafting',
  signed: 'Tanda tangan',
  registered: 'Terdaftar',
  closed: 'Arsip',
};

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tasksDueToday, setTasksDueToday] = useState<Awaited<ReturnType<typeof getTasksListApi>>['data']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const today = todayISO();
      const [statsRes, tasksRes] = await Promise.all([
        getDashboardStatsApi(token),
        getTasksListApi(token, { limit: 50, due_from: today, due_to: today }),
      ]);
      setStats(statsRes);
      setTasksDueToday(tasksRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
      setStats(null);
      setTasksDueToday([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!stats) {
      return { aktif: 0, overdue: 0, sign: 0, closedThisMonth: 0 };
    }
    return {
      aktif: stats.case_counts.drafting,
      overdue: stats.tasks.overdue,
      sign: stats.case_counts.signed,
      closedThisMonth: stats.case_counts.closed_this_month,
    };
  }, [stats]);

  const caseByTypeData = useMemo(() => {
    if (!stats) return [];
    return stats.cases_by_type.map((item) => ({
      name: item.jenis_akta || 'Lainnya',
      value: item.count,
    }));
  }, [stats]);

  const caseAgingData = useMemo(() => {
    if (!stats) return [];
    const c = stats.case_counts;
    return [
      { name: STATUS_LABELS.drafting ?? 'Drafting', value: c.drafting },
      { name: STATUS_LABELS.signed ?? 'Tanda tangan', value: c.signed },
      { name: STATUS_LABELS.registered ?? 'Terdaftar', value: c.registered },
      { name: STATUS_LABELS.closed ?? 'Arsip', value: c.closed },
    ].filter((d) => d.value > 0);
  }, [stats]);

  return (
    <>
      <Toolbar>
        <ToolbarHeading
          title="Dashboard"
          description={user?.name ?? user?.email ? `Selamat datang, ${user.name ?? user.email}` : undefined}
        />
        <ToolbarActions>
          <Button asChild>
            <Link href="/cases/notaris">
              <Plus className="me-2 size-4" />
              Berkas Baru
            </Link>
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="container space-y-6 pb-8">
        {error && (
          <p className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-80 rounded-xl" />
              <Skeleton className="h-80 rounded-xl" />
            </div>
            <Skeleton className="h-80 rounded-xl" />
          </>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Aktif"
                value={kpis.aktif}
                icon={FileText}
                description="Berkas drafting"
              />
              <Link href="/tasks?overdue=1" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
                <KpiCard
                  title="Overdue"
                  value={kpis.overdue}
                  icon={AlertCircle}
                  description="Task melewati batas — klik untuk lihat daftar"
                />
              </Link>
              <KpiCard
                title="Tanda tangan"
                value={kpis.sign}
                icon={PenLine}
                description="Menunggu tanda tangan"
              />
              <KpiCard
                title="Arsip bulan ini"
                value={kpis.closedThisMonth}
                icon={Archive}
                description="Berkas ditutup bulan ini"
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <ChartWidget
                title="Berkas per jenis akta"
                data={caseByTypeData}
                variant="pie"
              />
              <TaskListWidget
                title="Task jatuh tempo hari ini"
                tasks={tasksDueToday}
                caseDetailPath={(id) => `/cases/${id}`}
              />
            </section>

            <section>
              <ChartWidget
                title="Berkas per status (Case Aging)"
                data={caseAgingData}
                variant="bar"
              />
            </section>
          </>
        )}
      </div>
    </>
  );
}
