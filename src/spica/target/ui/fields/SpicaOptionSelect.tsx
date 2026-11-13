import type { ReactNode } from 'react';
import { FormControl, NativeSelect } from '@mui/material';

export function SpicaOptionSelect({ part, label, value, disabled, onChange, children, inputAttributes }: {
  part?: string; label: string; value: string | number; disabled?: boolean; onChange(value: string): void;
  children: ReactNode; inputAttributes?: Record<string, string | number>;
}) {
  return <FormControl size="small" fullWidth variant="standard">
    <NativeSelect value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
      inputProps={{ 'aria-label': label, ...inputAttributes, ...(part ? { 'data-spica-part': part } : {}) }}>{children}</NativeSelect>
  </FormControl>;
}
