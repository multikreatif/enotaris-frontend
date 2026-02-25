'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { type DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function toDateRange(fromStr: string, toStr: string): DateRange | undefined {
  if (!fromStr) return undefined;
  const from = new Date(fromStr);
  if (isNaN(from.getTime())) return undefined;
  const to = toStr ? new Date(toStr) : undefined;
  return { from, to: to && !isNaN(to.getTime()) ? to : undefined };
}

function formatRange(fromStr: string, toStr: string): string {
  if (!fromStr) return 'Pilih rentang tanggal';
  const from = new Date(fromStr);
  if (isNaN(from.getTime())) return 'Pilih rentang tanggal';
  const fromFmt = format(from, 'd MMM yyyy', { locale: id });
  if (!toStr) return fromFmt;
  const to = new Date(toStr);
  if (isNaN(to.getTime())) return fromFmt;
  return `${fromFmt} – ${format(to, 'd MMM yyyy', { locale: id })}`;
}

export interface DateRangePickerProps {
  /** Tanggal mulai (YYYY-MM-DD) */
  from?: string;
  /** Tanggal akhir (YYYY-MM-DD) */
  to?: string;
  /** Callback: (from, to) string YYYY-MM-DD */
  onChange?: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
  /** Tinggi trigger, default h-8 */
  size?: 'sm' | 'md';
}

export function DateRangePicker({
  from = '',
  to = '',
  onChange,
  placeholder = 'Pilih rentang tanggal',
  className,
  size = 'sm',
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const range = toDateRange(from, to);

  const handleSelect = (r: DateRange | undefined) => {
    if (!r?.from) {
      onChange?.('', '');
      return;
    }
    const fromStr = format(r.from, 'yyyy-MM-dd');
    const toStr = r.to ? format(r.to, 'yyyy-MM-dd') : '';
    onChange?.(fromStr, toStr);
    if (r.from && r.to) setOpen(false);
  };

  const label = from ? formatRange(from, to) : placeholder;
  const triggerHeight = size === 'sm' ? 'h-8' : 'h-9';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal [&>span]:line-clamp-1',
            !from && 'text-muted-foreground',
            triggerHeight,
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 opacity-60" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={range?.from ?? new Date()}
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  );
}
