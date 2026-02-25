'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandCheck,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { ClientResponse } from '@/lib/api';

function clientLabel(c: ClientResponse) {
  return c.nik ? `${c.full_name} (${c.nik})` : c.full_name;
}

export function ClientSearchSelect({
  value,
  onValueChange,
  clients,
  disabled,
  placeholder = 'Pilih klien',
  searchPlaceholder = 'Cari nama atau NIK...',
  onAddClick,
  className,
}: {
  value: string;
  onValueChange: (id: string) => void;
  clients: ClientResponse[];
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  onAddClick?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = clients.find((c) => c.id === value);

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="flex-1 justify-between font-normal"
          >
            <span className={selected ? '' : 'text-muted-foreground'}>
              {selected ? clientLabel(selected) : placeholder}
            </span>
            <ChevronDown className="ms-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>Tidak ada klien ditemukan.</CommandEmpty>
              <CommandGroup>
                {clients.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.full_name} ${c.nik ?? ''}`}
                    onSelect={() => {
                      onValueChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <span className="grow">{clientLabel(c)}</span>
                    <CommandCheck className={cn(value === c.id ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {onAddClick && (
        <Button type="button" variant="outline" size="icon" onClick={onAddClick} title="Tambah klien baru">
          +
        </Button>
      )}
    </div>
  );
}
