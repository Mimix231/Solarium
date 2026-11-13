import { Checkbox, FormControlLabel } from '@mui/material';

export function SpicaToggle({ part, label, checked, disabled, onChange }: {
  part?: string; label: string; checked: boolean; disabled?: boolean; onChange(value: boolean): void;
}) {
  return <FormControlLabel className="spica-material-toggle" label={label} control={<Checkbox size="small" checked={checked}
    disabled={disabled} onChange={event => onChange(event.target.checked)}
    slotProps={{ input: { ...(part ? { 'data-spica-part': part } : {}), ...(part === 'record-table-filter' ? { 'data-spica-table-filter': '' } : {}), 'aria-label': label } }} />} />;
}
