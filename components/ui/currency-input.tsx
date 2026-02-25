'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Format number as Indonesian Rupiah (e.g. 2.500.000). */
export function formatRupiah(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Parse string to number; strips non-digits. Empty string → null. */
export function parseRupiahInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return null;
  const n = parseInt(digits, 10);
  return Number.isNaN(n) ? null : n;
}

/** Index in formatted string after the n-th digit (for cursor restore). */
function positionAfterNDigits(str: string, n: number): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) {
      count++;
      if (count >= n) return i + 1;
    }
  }
  return str.length;
}

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Placeholder when empty (default: "0") */
  placeholder?: string;
}

/**
 * Input nominal Rupiah. Auto-format saat mengetik (titik pemisah ribuan).
 * value/onChange dalam number | null.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, placeholder = '0', id, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const cursorRestoreRef = React.useRef<number | null>(null);

    const numericValue = value != null && !Number.isNaN(value) ? value : null;
    const displayValue = formatRupiah(numericValue);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const cursorPos = input.selectionStart ?? 0;
      const digitsBeforeCursor = (input.value.slice(0, cursorPos).match(/\d/g) || []).length;
      const next = parseRupiahInput(input.value);
      cursorRestoreRef.current = digitsBeforeCursor;
      onChange(next);
    };

    React.useEffect(() => {
      const digitsToRestore = cursorRestoreRef.current;
      if (digitsToRestore === null || !inputRef.current) return;
      cursorRestoreRef.current = null;
      const formatted = formatRupiah(numericValue);
      const pos = positionAfterNDigits(formatted, digitsToRestore);
      inputRef.current.setSelectionRange(pos, pos);
    }, [numericValue]);

    return (
      <Input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn('tabular-nums', className)}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        {...props}
      />
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';

export { CurrencyInput };
