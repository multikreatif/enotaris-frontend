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
import type { UserResponse } from '@/lib/auth-types';

function userLabel(u: UserResponse) {
  return u.name?.trim() ? `${u.name} (${u.email})` : u.email;
}

export function UserSearchSelect({
  value,
  onValueChange,
  users,
  disabled,
  placeholder = 'Pilih staf',
  searchPlaceholder = 'Cari nama atau email...',
  className,
}: {
  value: string;
  onValueChange: (id: string) => void;
  users: UserResponse[];
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = users.find((u) => u.id === value);

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
              {selected ? userLabel(selected) : placeholder}
            </span>
            <ChevronDown className="ms-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>Tidak ada staf ditemukan.</CommandEmpty>
              <CommandGroup>
                {users.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`${u.name ?? ''} ${u.email}`}
                    onSelect={() => {
                      onValueChange(u.id);
                      setOpen(false);
                    }}
                  >
                    <span className="grow">{userLabel(u)}</span>
                    <CommandCheck className={cn(value === u.id ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
