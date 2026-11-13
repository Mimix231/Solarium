import { TextField } from '@mui/material';

export function SpicaTextInput({ part, field, label, value, onChange, type = 'text', multiline = false, rows,
  maxLength = 16000, required, min, max, placeholder }: {
  part?: string; field?: string; label: string; value: string | number; onChange(value: string): void;
  type?: 'text' | 'search' | 'number'; multiline?: boolean; rows?: number; maxLength?: number;
  required?: boolean; min?: number; max?: number; placeholder?: string;
}) {
  return <TextField fullWidth size="small" label={label} value={value} type={multiline ? undefined : type}
    multiline={multiline} minRows={multiline ? (rows ?? 3) : undefined} maxRows={multiline ? Math.max(rows ?? 3, 10) : undefined}
    placeholder={placeholder} required={required} onChange={event => onChange(event.target.value)}
    slotProps={{ htmlInput: { ...(part ? { 'data-spica-part': part } : {}), ...(field ? { 'data-spica-field': field } : {}),
      maxLength, ...(type === 'number' ? { min, max, step: 'any' } : {}) } }} />;
}

/** MUI NativeSelect intentionally retains a real select for native scenario testing. */
